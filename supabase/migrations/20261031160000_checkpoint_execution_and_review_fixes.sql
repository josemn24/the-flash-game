-- Preserve accepted checkpoint review and accept single-endpoint drafts.
set local check_function_bodies = off;

create or replace function private.connect_pairs_draft_valid(public_payload jsonb, draft jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  board_rows integer;
  board_columns integer;
  cell_count integer;
  pair jsonb;
  entry jsonb;
  pair_id text;
  path jsonb;
  endpoint_a integer;
  endpoint_b integer;
  previous_cell integer;
  first_cell integer;
  path_index integer;
  cell integer;
  occupied integer[] := '{}';
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(draft) is distinct from 'object'
    or jsonb_typeof(draft->'paths') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(draft)) <> 1
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or jsonb_typeof(public_payload->'pairs') is distinct from 'array' then return false; end if;
  board_rows := (public_payload->'grid'->>'rows')::integer;
  board_columns := (public_payload->'grid'->>'columns')::integer;
  if board_rows not between 4 and 8 or board_columns <> board_rows then return false; end if;
  cell_count := board_rows * board_columns;
  if jsonb_array_length(public_payload->'pairs') not between 3 and board_rows
    or (select count(*) from jsonb_object_keys(draft->'paths')) > jsonb_array_length(public_payload->'pairs') then
    return false;
  end if;
  for pair_id in select jsonb_object_keys(draft->'paths') loop
    if not exists (select 1 from jsonb_array_elements(public_payload->'pairs') p where p->>'id' = pair_id) then
      return false;
    end if;
  end loop;
  for pair in select value from jsonb_array_elements(public_payload->'pairs') loop
    if jsonb_typeof(pair) is distinct from 'object'
      or jsonb_typeof(pair->'id') is distinct from 'string'
      or jsonb_typeof(pair->'endpoints') is distinct from 'array'
      or jsonb_array_length(pair->'endpoints') <> 2 then return false; end if;
    pair_id := pair->>'id';
    if pair_id is null or btrim(pair_id) = '' then return false; end if;
    endpoint_a := (pair->'endpoints'->>0)::integer;
    endpoint_b := (pair->'endpoints'->>1)::integer;
    if endpoint_a not between 0 and cell_count - 1 or endpoint_b not between 0 and cell_count - 1
      or endpoint_a = endpoint_b then return false; end if;
    path := draft->'paths'->pair_id;
    if path is null then continue; end if;
    if jsonb_typeof(path) is distinct from 'array' then return false; end if;
    if jsonb_array_length(path) = 0 then continue; end if;
    if jsonb_array_length(path) > cell_count then return false; end if;
    first_cell := null;
    previous_cell := null;
    path_index := 0;
    for entry in select value from jsonb_array_elements(path) loop
      if jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and cell_count - 1 then return false; end if;
      cell := (entry #>> '{}')::integer;
      path_index := path_index + 1;
      if cell = any(occupied) then return false; end if;
      if previous_cell is null then
        if cell not in (endpoint_a, endpoint_b) then return false; end if;
        first_cell := cell;
      else
        if abs(cell / board_columns - previous_cell / board_columns)
          + abs(cell % board_columns - previous_cell % board_columns) <> 1 then return false; end if;
        if exists (
          select 1 from jsonb_array_elements(public_payload->'pairs') other_pair
          cross join lateral jsonb_array_elements_text(other_pair->'endpoints') endpoint
          where other_pair->>'id' <> pair_id and endpoint::integer = cell
        ) then return false; end if;
        if cell in (endpoint_a, endpoint_b) and cell <> first_cell
          and path_index <> jsonb_array_length(path) then return false; end if;
      end if;
      previous_cell := cell;
      occupied := array_append(occupied, cell);
    end loop;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or data_exception then
  return false;
end;
$$;
alter function private.connect_pairs_draft_valid(jsonb,jsonb) owner to postgres;
revoke all on function private.connect_pairs_draft_valid(jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function private.handle_attempt_closure(
  op text,
  input jsonb,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  target_version private.challenge_versions,
  instant timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
  snapshot jsonb;
  points integer;
  target_status text;
  completion_outcome text;
  time_trial_reason text;
  survival_lives integer;
  survival_mistakes integer;
  survival_resolved integer;
  survival_total integer;
  pyramid_resolved integer;
  pyramid_total integer;
  result jsonb;
begin
  clear_progress := false;
  if op = 'complete' then
    if cv.mode in ('alphabet', 'time-trial') then
      -- Preserve an already received answer using the trusted evaluator's result.
      -- No evaluator or asset calls are made while this attempt is locked.
      if input ? 'pendingEvaluation' then
        if jsonb_typeof(input->'pendingEvaluation') is distinct from 'object'
          or not (input->'pendingEvaluation') ?& array['receiptId','status','points']
          or exists (select 1 from jsonb_object_keys(input->'pendingEvaluation') k
            where k <> all(array['receiptId','status','points','resultDetails'])) then
          raise exception 'invalid_command' using errcode = '22023';
        end if;
        select * into receipt from private.answer_receipts r
          where r.id = (input->'pendingEvaluation'->>'receiptId')::uuid and r.attempt_id = a.id
            and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id);
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if receipt.answer is null or receipt.answer = 'null'::jsonb then
          snapshot := private.attempt_review_state(a.id, receipt.challenge_item_id);
        end if;
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
          receipt_id, status, answer, result_details, review_state, points, presented_at, submitted_at,
          time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, a.challenge_version_id, receipt.id,
          input->'pendingEvaluation'->>'status', receipt.answer,
          input->'pendingEvaluation'->'resultDetails', snapshot, (input->'pendingEvaluation'->>'points')::integer,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms,
          'complete:evaluation:' || receipt.id);
      end if;
      if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
        and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
        raise exception 'unfinished_interaction' using errcode = '55000';
      end if;
      if cv.mode = 'time-trial' then
        time_trial_reason := private.time_trial_progress(a.id)->>'endReason';
        if time_trial_reason is null then raise exception 'time_trial_not_terminal' using errcode = '55000'; end if;
        if time_trial_reason = 'time_limit' then
          perform private.close_time_trial_interaction(a.id, a.deadline_at, 'timeout');
        end if;
      elsif private.next_attempt_item(a.id) is not null then
        if instant < a.deadline_at then
          raise exception 'alphabet_deadline_not_reached' using errcode = '55000',
            detail = jsonb_build_object('retryAfterSeconds',
              greatest(1, ceil(extract(epoch from (a.deadline_at - instant)))::integer))::text;
        end if;
        update private.interaction_intervals x
          set ended_at = greatest(x.started_at, least(instant, a.deadline_at)), end_reason = 'timeout'
          where x.attempt_id = a.id and x.ended_at is null;
        -- Unvisited letters have zero elapsed time and no invented visit.
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id,
          answer, received_at, presented_at, effective_submitted_at, time_used_ms, timed_out)
        select a.id, pending.id, a.challenge_version_id, null, a.deadline_at,
          coalesce(visits.presented_at, a.deadline_at), a.deadline_at,
          coalesce(visits.time_used_ms, 0), true
        from private.challenge_items pending
        left join lateral (
          select min(x.started_at) as presented_at,
            sum(floor(extract(epoch from (x.ended_at - x.started_at)) * 1000))::bigint as time_used_ms
          from private.interaction_intervals x
          where x.attempt_id = a.id and x.challenge_item_id = pending.id
        ) visits on true
        where pending.challenge_version_id = a.challenge_version_id
          and not exists (select 1 from private.attempt_answers aa
            where aa.attempt_id = a.id and aa.challenge_item_id = pending.id)
          and not exists (select 1 from private.answer_receipts r
            where r.attempt_id = a.id and r.challenge_item_id = pending.id);
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
          receipt_id, status, answer, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        select a.id, r.challenge_item_id, a.challenge_version_id, r.id, 'unanswered', r.answer, 0,
          r.presented_at, r.effective_submitted_at, r.time_used_ms,
          'alphabet:timeout:' || r.challenge_item_id
        from private.answer_receipts r where r.attempt_id = a.id
          and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id);
      end if;
    elsif input ? 'pendingEvaluation' then
      raise exception 'invalid_command' using errcode = '22023';
    end if;
    if exists (select 1 from private.interaction_intervals where attempt_id = a.id and ended_at is null)
      or exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
        and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
      raise exception 'unfinished_interaction' using errcode = '55000';
    end if;
    if not exists (select 1 from private.attempt_answers where attempt_id = a.id) then
      raise exception 'no_evaluated_answers' using errcode = '55000';
    end if;
    if cv.mode = 'survival' then
      select count(*)::integer,
        coalesce(sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when answer_question.type = 'queens'
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0
        end), 0)::integer
      into survival_resolved, survival_mistakes
      from private.attempt_answers answer
      join private.challenge_items answer_item on answer_item.id = answer.challenge_item_id
      join private.question_versions answer_question on answer_question.id = answer_item.question_version_id
      where answer.attempt_id = a.id;
      select count(*)::integer into survival_total
      from private.challenge_items challenge_item
      where challenge_item.challenge_version_id = a.challenge_version_id;
      survival_lives := greatest((cv.mode_config->>'lives')::integer - survival_mistakes, 0);
      if survival_lives > 0 and survival_resolved < survival_total then
        raise exception 'survival_not_terminal' using errcode = '55000';
      end if;
      completion_outcome := case when survival_lives = 0 then 'eliminated' else 'survived' end;
    elsif cv.mode = 'pyramid' then
      select count(*)::integer into pyramid_total
      from private.challenge_items challenge_item
      where challenge_item.challenge_version_id = a.challenge_version_id;
      select count(*)::integer into pyramid_resolved
      from private.attempt_answers answer where answer.attempt_id = a.id;
      if exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then
        completion_outcome := 'failed';
      elsif pyramid_total = 7 and pyramid_resolved = pyramid_total then
        completion_outcome := 'summit';
      else
        raise exception 'pyramid_not_terminal' using errcode = '55000';
      end if;
    elsif cv.mode in ('alphabet', 'time-trial') then
      completion_outcome := null;
    else
      if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
        raise exception 'incomplete_challenge' using errcode = '55000';
      end if;
      completion_outcome := null;
    end if;
    select coalesce(sum(answer.points), 0)::integer into points
    from private.attempt_answers answer where answer.attempt_id = a.id;
    target_status := 'completed';
  else
    target_status := 'abandoned'; points := null; completion_outcome := null;
    update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
      from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
  end if;
  delete from private.prepared_interactions where attempt_id = a.id;
  update public.attempts set status = target_status, score = points, completed_at = instant,
    terminal_reason = case when cv.mode = 'time-trial' and op = 'complete' then time_trial_reason else terminal_reason end,
    outcome = completion_outcome, progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
  update private.attempt_sessions
  set revoked_at = instant, revocation_reason = 'terminal'
  where attempt_id = a.id and revoked_at is null;
  if op = 'complete' then
    insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
    values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
  end if;
  result := jsonb_build_object('status', a.status, 'score', a.score,
    'outcome', a.outcome, 'challengeMode', cv.mode,
    'livesRemaining', case when cv.mode = 'survival' then survival_lives else null end);
  if op = 'complete' and cv.mode in ('alphabet', 'time-trial') then
    result := result || jsonb_build_object('answers', coalesce((
      select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
        'answer', aa.answer, 'status', aa.status, 'points', aa.points,
        'timeUsedMs', aa.time_used_ms, 'resultDetails', aa.result_details,
        'reviewState', aa.review_state) order by ci.position)
      from private.attempt_answers aa join private.challenge_items ci on ci.id = aa.challenge_item_id
      where aa.attempt_id = a.id
    ), '[]'::jsonb));
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
alter function private.handle_attempt_closure(text, jsonb, public.attempts, public.scheduled_challenges, private.challenge_versions, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_closure(text, jsonb, public.attempts, public.scheduled_challenges, private.challenge_versions, timestamptz) from public, anon, authenticated, service_role;
