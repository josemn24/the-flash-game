-- Attempt operations invoked only by the authorized coordinator.
set local check_function_bodies = off;

create function private.handle_attempt_activate(
  input jsonb,
  target_attempt public.attempts,
  instant timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  segment private.interaction_intervals%rowtype;
  prepared private.prepared_interactions%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  result jsonb;
begin
  clear_progress := false;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if found then
    if segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
      raise exception 'interaction_not_presented' using errcode = '55000';
    end if;
    select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  else
    select * into prepared from private.prepared_interactions
      where attempt_id = a.id and challenge_item_id = (input->>'challengeItemId')::uuid for update;
    if not found then raise exception 'interaction_not_presented' using errcode = '55000'; end if;
    select * into item from private.challenge_items where id = prepared.challenge_item_id;
    insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id,
      scope, started_at, deadline_at)
    select a.id, a.challenge_version_id, item.id, 'level', instant,
      instant + q.time_limit_ms * interval '1 millisecond'
    from private.question_versions q where q.id = item.question_version_id
    returning * into unit;
    insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
      values(a.id, item.id, unit.id, instant) returning * into segment;
    delete from private.prepared_interactions where attempt_id = a.id;
  end if;
  result := jsonb_build_object(
    'challengeItemId', segment.challenge_item_id,
    'presentedAt', segment.started_at,
    'deadlineAt', unit.deadline_at,
    'timedOut', instant >= unit.deadline_at);
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
alter function private.handle_attempt_activate(jsonb, public.attempts, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_activate(jsonb, public.attempts, timestamptz) from public, anon, authenticated, service_role;

create function private.handle_attempt_submission(
  op text,
  input jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant timestamptz,
  received_at timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  received timestamptz := received_at;
  question_type text;
  question_payload jsonb;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  receipt private.answer_receipts%rowtype;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  result jsonb;
begin
  clear_progress := false;
  if cv.mode = 'time-trial' then received := clock_timestamp(); end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if cv.mode = 'time-trial' then
    select q.type, q.public_payload into question_type, question_payload
      from private.question_versions q where q.id = item.question_version_id;
    if question_type = 'queens' and (op = 'pass' or received < a.deadline_at) then
      raise exception 'queens_requires_validation_command' using errcode = '22023';
    elsif question_type = 'connect-pairs' then
      if op = 'pass' then raise exception 'pass_unavailable' using errcode = '55000'; end if;
      if received >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
      if not private.connect_pairs_answer_valid(question_payload, input->'answer') then
        raise exception 'invalid_connect_pairs_answer' using errcode = '22023';
      end if;
    end if;
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'matching'
  ) and (
    (instant < unit.deadline_at and not private.matching_answer_valid(
      (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
      input->'answer',
      true
    ))
    or (instant >= unit.deadline_at and jsonb_typeof(input->'answer') <> 'null'
      and not private.matching_answer_valid(
        (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
        input->'answer',
        false
      ))
  ) then
    raise exception 'invalid_matching_answer' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'mini-wordle'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'logic-code'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'queens'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'queens_requires_placement_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-search'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_search_requires_selection_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-hashtag'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_hashtag_requires_swap_command' using errcode = '22023';
  end if;
  -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
  if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  late := received >= unit.deadline_at;
  effective := least(received, unit.deadline_at);
  if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
  update private.interaction_intervals set ended_at = effective,
    end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
  if op = 'pass' then result := jsonb_build_object('passed', true);
  else
    select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
      into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
    insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
      received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, segment.challenge_item_id, a.challenge_version_id,
      case when input->'answer' = 'null'::jsonb and exists (
        select 1 from private.question_versions timeout_question
        where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
      ) then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
      else input->'answer' end,
      received, presented,
      effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
    if input->'answer' = 'null'::jsonb and exists (
      select 1 from private.question_versions timeout_question
      where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
    ) then
      clear_progress := true;
    end if;
    result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
      'receivedAt', received, 'presentedAt', presented);
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
alter function private.handle_attempt_submission(text, jsonb, public.attempts, private.challenge_versions, timestamptz, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_submission(text, jsonb, public.attempts, private.challenge_versions, timestamptz, timestamptz) from public, anon, authenticated, service_role;

create function private.handle_attempt_prepare(
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  segment private.interaction_intervals%rowtype;
  prepared private.prepared_interactions%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  result jsonb;
begin
  clear_progress := false;
  if cv.mode = 'time-trial' then
    if (private.time_trial_progress(a.id)->>'endReason') is not null then
      raise exception 'time_trial_terminal' using errcode = '55000';
    end if;
  end if;
  if cv.mode = 'pyramid' and exists (
    select 1 from private.attempt_answers answer
    where answer.attempt_id = a.id and answer.status <> 'correct'
  ) then
    raise exception 'pyramid_level_failed' using errcode = '55000';
  end if;
  if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  )) then raise exception 'evaluation_pending' using errcode = '55000'; end if;
  if cv.mode = 'pyramid' then
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
    else
      select * into prepared from private.prepared_interactions where attempt_id = a.id for update;
      if found then
        select * into item from private.challenge_items where id = prepared.challenge_item_id;
      else
        select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
        if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
        insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
          values(a.id, a.challenge_version_id, item.id);
      end if;
    end if;
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
    if found then
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
    else
      select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
      if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
      select * into unit from private.attempt_timing_units where attempt_id = a.id and challenge_item_id = item.id;
      if not found then
        insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
        select a.id, a.challenge_version_id, item.id,
          case when cv.mode in ('alphabet','time-trial') then 'attempt' else 'question' end,
          case when cv.mode = 'alphabet' then a.started_at else instant end,
          case when cv.mode = 'alphabet' then a.deadline_at when cv.mode = 'time-trial' then coalesce(a.deadline_at, instant + cv.global_time_limit_ms * interval '1 millisecond') else instant + q.time_limit_ms * interval '1 millisecond' end
        from private.question_versions q where q.id = item.question_version_id returning * into unit;
      end if;
      if cv.mode = 'time-trial' and a.deadline_at is null then
        update public.attempts set deadline_at = unit.deadline_at, lock_version = lock_version + 1
          where id = a.id returning * into a;
        update private.attempt_sessions set expires_at = a.deadline_at where attempt_id = a.id and revoked_at is null;
      end if;
      insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
        values(a.id, item.id, unit.id, least(instant, unit.deadline_at)) returning * into segment;
    end if;
  end if;
  perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
  select jsonb_build_object('challengeItemId', item.id, 'questionType', q.type,
    'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', case
      when (cv.mode <> 'pyramid' or segment.id is not null) and instant >= unit.deadline_at then null
      when q.type = 'progressive-clues' then private.progressive_clues_public_payload(item.id)
      when q.type = 'matching' then private.matching_public_payload(item.id)
      else q.public_payload
    end,
    'presentedAt', case when segment.id is null then null else segment.started_at end,
    'deadlineAt', case when segment.id is null then null else unit.deadline_at end,
    'timedOut', case when segment.id is null then false else instant >= unit.deadline_at end,
    'progress', case
      when q.type = 'mini-wordle' then private.mini_wordle_progress(a.id, item.id)
      when q.type = 'logic-code' then private.logic_code_progress(a.id, item.id)
      when q.type = 'progressive-clues' then private.progressive_clues_progress(a.id, item.id)
      when q.type = 'queens' then private.queens_progress(a.id, item.id)
      when q.type = 'word-search' then private.word_search_progress(a.id, item.id)
      when q.type = 'word-hashtag' then private.word_hashtag_progress(a.id, item.id) - 'solved'
      when q.type = 'short-text' and cv.mode = 'alphabet' then (
        select jsonb_build_object(
          'kind', 'alphabet',
          'round', greatest(1, 1 + floor((
            (select count(*) from private.interaction_intervals interval_row
              where interval_row.attempt_id = a.id)::numeric /
            nullif((select count(*) from private.challenge_items round_item
              where round_item.challenge_version_id = a.challenge_version_id)::numeric, 0)
          ))::integer),
          'currentIndex', item.position - 1,
          'playedCount', (select count(distinct interval_row.challenge_item_id)::integer
            from private.interaction_intervals interval_row
            where interval_row.attempt_id = a.id),
          'correctAnswers', (select count(*)::integer from private.attempt_answers answer_row
            where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
          'incorrectAnswers', (select count(*)::integer from private.attempt_answers answer_row
            where answer_row.attempt_id = a.id and answer_row.status = 'incorrect'),
          'elapsedTimeMs', coalesce((select sum(floor(extract(epoch from
            (interval_row.ended_at - interval_row.started_at)) * 1000))::bigint
            from private.interaction_intervals interval_row where interval_row.attempt_id = a.id), 0)::bigint,
          'deadlineAt', a.deadline_at,
          'lastCorrectAt', (select max(answer_row.submitted_at) from private.attempt_answers answer_row
            where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
          'letters', coalesce((select jsonb_agg(jsonb_build_object(
            'letter', all_item.mode_config->>'letter',
            'challengeItemId', all_item.id,
            'status', case
              when answer_row.status is not null then answer_row.status
              when exists (select 1 from private.interaction_intervals open_interval
                where open_interval.attempt_id = a.id and open_interval.challenge_item_id = all_item.id
                  and open_interval.ended_at is null) then 'active'
              when exists (select 1 from private.interaction_intervals visited
                where visited.attempt_id = a.id and visited.challenge_item_id = all_item.id) then 'passed'
              else 'unvisited' end,
            'answer', case when answer_row.answer is null then null
              else answer_row.answer #>> '{}' end
          ) order by all_item.position)
            from private.challenge_items all_item
            left join private.attempt_answers answer_row
              on answer_row.attempt_id = a.id and answer_row.challenge_item_id = all_item.id
            where all_item.challenge_version_id = a.challenge_version_id), '[]'::jsonb)
        )
      )
      else null end)
    into result from private.question_versions q where q.id = item.question_version_id;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
alter function private.handle_attempt_prepare(public.attempts, private.challenge_versions, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_prepare(public.attempts, private.challenge_versions, timestamptz) from public, anon, authenticated, service_role;
