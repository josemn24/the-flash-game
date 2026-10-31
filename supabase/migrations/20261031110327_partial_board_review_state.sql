SET local check_function_bodies = off;

DROP FUNCTION "public"."get_my_flash_result"(uuid);

DROP FUNCTION "public"."get_my_pyramid_result"(uuid);

DROP FUNCTION "public"."get_my_survival_result"(uuid);

DROP FUNCTION "public"."get_my_time_trial_result"(uuid);

DROP FUNCTION "public"."get_room_member_review"(text, uuid, uuid);

ALTER TABLE "private"."attempt_answers"
  ADD COLUMN "review_state" jsonb;

CREATE OR REPLACE FUNCTION private.attempt_review_state (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  draft jsonb;
  question_type text;
  public_payload jsonb;
  player_queens integer[];
  prefilled_queens integer[];
begin
  select a.progress_payload, q.type, q.public_payload
    into draft, question_type, public_payload
  from public.attempts a
  join private.challenge_items i on i.id = target_item
    and i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  where a.id = target_attempt
    and a.progress_payload->>'challengeItemId' = target_item::text;
  if not found or jsonb_typeof(draft) is distinct from 'object' then return null; end if;

  if question_type = 'connect-pairs' and draft->>'kind' = 'connect-pairs'
    and jsonb_typeof(draft->'paths') = 'object'
    and private.connect_pairs_draft_valid(public_payload, jsonb_build_object('paths', draft->'paths'))
    and exists (select 1 from jsonb_each(draft->'paths') path where jsonb_array_length(path.value) > 0) then
    return jsonb_build_object('type', 'connect-pairs', 'paths', draft->'paths');
  end if;

  if question_type = 'queens' and draft->>'kind' = 'queens'
    and jsonb_typeof(draft->'queens') = 'array'
    and jsonb_array_length(draft->'queens') <= 64
    and not exists (
      select 1 from jsonb_array_elements(draft->'queens') cell
      where jsonb_typeof(cell) <> 'number'
        or (cell #>> '{}')::numeric <> trunc((cell #>> '{}')::numeric)
        or (cell #>> '{}')::integer not between 0 and 63
    ) then
    select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
      into player_queens from jsonb_array_elements_text(draft->'queens') value;
    select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
      into prefilled_queens from jsonb_array_elements_text(coalesce(public_payload->'prefilledQueens', '[]'::jsonb)) value;
    if exists (select 1 from unnest(player_queens) cell where not cell = any(prefilled_queens)) then
      return jsonb_build_object('type', 'queens', 'queens', to_jsonb(player_queens));
    end if;
  end if;
  return null;
exception when invalid_text_representation or numeric_value_out_of_range or data_exception then
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.close_time_trial_interaction (
  target_attempt uuid,
  closed_at      timestamp with time zone,
  reason         text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare segment private.interaction_intervals%rowtype; receipt private.answer_receipts%rowtype; version_id uuid; snapshot jsonb;
begin
  select * into segment from private.interaction_intervals where attempt_id = target_attempt and ended_at is null for update;
  if not found then return; end if;
  select challenge_version_id into version_id from public.attempts where id = target_attempt;
  update private.interaction_intervals set ended_at = greatest(started_at,closed_at), end_reason = reason where id = segment.id;
  snapshot := private.attempt_review_state(target_attempt, segment.challenge_item_id);
  insert into private.answer_receipts(attempt_id,challenge_item_id,challenge_version_id,answer,received_at,presented_at,effective_submitted_at,time_used_ms,timed_out)
  values(target_attempt,segment.challenge_item_id,version_id,null,clock_timestamp(),segment.started_at,
    greatest(segment.started_at,closed_at),greatest(0,floor(extract(epoch from (closed_at - segment.started_at))*1000))::bigint,true)
  returning * into receipt;
  insert into private.attempt_answers(attempt_id,challenge_item_id,challenge_version_id,receipt_id,status,answer,review_state,points,presented_at,submitted_at,time_used_ms,idempotency_key)
  values(target_attempt,segment.challenge_item_id,version_id,receipt.id,'unanswered',null,snapshot,0,receipt.presented_at,receipt.effective_submitted_at,receipt.time_used_ms,'time-trial:timeout:' || receipt.id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.connect_pairs_answer_valid (
  public_payload jsonb,
  answer         jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  pair jsonb;
  path jsonb;
  entry jsonb;
  pair_id text;
  cell integer;
  previous_cell integer;
  first_cell integer;
  path_index integer;
  endpoint_a integer;
  endpoint_b integer;
  board_rows integer;
  board_columns integer;
  cell_count integer;
  occupied integer[] := array[]::integer[];
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or public_payload->'requireFullCoverage' is distinct from 'true'::jsonb
    or jsonb_typeof(answer) is distinct from 'object' then return false; end if;
  if jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or public_payload->'grid'->>'rows' !~ '^[4-8]([.]0+)?$'
    or public_payload->'grid'->>'columns' !~ '^[4-8]([.]0+)?$'
    or (public_payload->'grid'->>'columns')::numeric <> (public_payload->'grid'->>'rows')::numeric then return false; end if;
  board_rows := (public_payload->'grid'->>'rows')::integer;
  board_columns := (public_payload->'grid'->>'columns')::integer;
  cell_count := board_rows * board_columns;
  if jsonb_typeof(public_payload->'pairs') is distinct from 'array'
    or jsonb_typeof(answer->'paths') is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(answer)) <> 1 then return false; end if;
  if jsonb_array_length(public_payload->'pairs') not between 3 and board_rows then return false; end if;
  if (select count(*) from jsonb_object_keys(answer->'paths')) <> jsonb_array_length(public_payload->'pairs') then
    return false;
  end if;
  for pair in select value from jsonb_array_elements(public_payload->'pairs') loop
    if jsonb_typeof(pair) is distinct from 'object'
      or jsonb_typeof(pair->'id') is distinct from 'string'
      or jsonb_typeof(pair->'endpoints') is distinct from 'array' then return false; end if;
    if jsonb_array_length(pair->'endpoints') <> 2 then return false; end if;
    for entry in select value from jsonb_array_elements(pair->'endpoints') loop
      if jsonb_typeof(entry) is distinct from 'number' then return false; end if;
      if (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and cell_count - 1 then return false; end if;
    end loop;
    pair_id := pair->>'id';
    endpoint_a := (pair->'endpoints'->>0)::integer;
    endpoint_b := (pair->'endpoints'->>1)::integer;
    if pair_id is null or endpoint_a is null or endpoint_b is null or endpoint_a = endpoint_b then return false; end if;
    path := answer->'paths'->pair_id;
    if jsonb_typeof(path) is distinct from 'array' then return false; end if;
    if jsonb_array_length(path) not between 2 and cell_count then return false; end if;
    previous_cell := null;
    first_cell := null;
    for entry in select value from jsonb_array_elements(path) loop
      if jsonb_typeof(entry) <> 'number' then return false; end if;
      if (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and cell_count - 1 then return false; end if;
      cell := (entry #>> '{}')::integer;
      if cell = any(occupied) then return false; end if;
      if previous_cell is not null and abs(cell / board_columns - previous_cell / board_columns)
        + abs(cell % board_columns - previous_cell % board_columns) <> 1 then
        return false;
      end if;
      first_cell := coalesce(first_cell,cell);
      previous_cell := cell;
      occupied := array_append(occupied,cell);
    end loop;
    if not ((first_cell = endpoint_a and previous_cell = endpoint_b)
      or (first_cell = endpoint_b and previous_cell = endpoint_a)) then return false; end if;
  end loop;
  return cardinality(occupied) = cell_count;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION private.connect_pairs_draft_valid (
  public_payload jsonb,
  draft          jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
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
    if previous_cell in (endpoint_a, endpoint_b) and previous_cell = first_cell then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or data_exception then
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_closure (
  op              text,
  input           jsonb,
  target_attempt  public.attempts,
  target_schedule public.scheduled_challenges,
  target_version  private.challenge_versions,
  instant         timestamp with time zone
)
  RETURNS TABLE (
    updated_attempt  public.attempts,
    operation_result jsonb,
    clear_progress   boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
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
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
          receipt_id, status, answer, result_details, points, presented_at, submitted_at,
          time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, a.challenge_version_id, receipt.id,
          input->'pendingEvaluation'->>'status', receipt.answer,
          input->'pendingEvaluation'->'resultDetails', (input->'pendingEvaluation'->>'points')::integer,
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
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_evaluation (
  input          jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions
)
  RETURNS TABLE (
    updated_attempt  public.attempts,
    operation_result jsonb,
    clear_progress   boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
  snapshot jsonb;
  result jsonb;
begin
  clear_progress := false;
  select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
  if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
  if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
    raise exception 'already_evaluated' using errcode = '55000';
  end if;
  if receipt.answer is null or receipt.answer = 'null'::jsonb then
    snapshot := private.attempt_review_state(a.id, receipt.challenge_item_id);
  end if;
  -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
  insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
    status, answer, result_details, review_state, points, presented_at, submitted_at, time_used_ms, idempotency_key)
  values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
    input->>'status', receipt.answer, input->'resultDetails', snapshot,
    case when cv.mode = 'time-trial' then case when input->>'status' = 'correct' then (select allocated.points from private.challenge_items allocated where allocated.id = receipt.challenge_item_id) else 0 end when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
      else (input->>'points')::integer end,
    receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
  result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status',
    'points', case when cv.mode = 'time-trial' then case when input->>'status' = 'correct' then (select allocated.points from private.challenge_items allocated where allocated.id = receipt.challenge_item_id) else 0 end when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
      else (input->>'points')::integer end) || jsonb_strip_nulls(jsonb_build_object('reviewState', snapshot));
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_prepare (
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant        timestamp with time zone
)
  RETURNS TABLE (
    updated_attempt  public.attempts,
    operation_result jsonb,
    clear_progress   boolean
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
      when q.type = 'connect-pairs' and jsonb_typeof(a.progress_payload) = 'object'
        and a.progress_payload->>'kind' = 'connect-pairs'
        and a.progress_payload->>'challengeItemId' = item.id::text
        and private.connect_pairs_draft_valid(q.public_payload,
          jsonb_build_object('paths', a.progress_payload->'paths'))
        then jsonb_build_object('kind', 'connect-pairs', 'paths', a.progress_payload->'paths')
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
$function$;

CREATE OR REPLACE FUNCTION private.read_abandoned_attempt (
  target_attempt uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'scheduledChallengeId', a.scheduled_challenge_id,
    'result', coalesce(command.result, jsonb_strip_nulls(jsonb_build_object(
      'attemptId', a.id,
      'lockVersion', a.lock_version,
      'status', a.status,
      'score', a.score,
      'outcome', a.outcome,
      'terminalReason', a.terminal_reason,
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'challengeItemId', answer.challenge_item_id,
          'answer', answer.answer,
          'status', answer.status,
          'points', answer.points,
          'timeUsedMs', answer.time_used_ms,
          'resultDetails', answer.result_details,
          'reviewState', answer.review_state
        ) order by item.position)
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id
      ), '[]'::jsonb)
    ))) || jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome, 'score', a.score)
  )
  from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  left join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  left join private.command_requests command on command.actor_id = a.player_id
    and command.operation = 'abandon' and command.input->>'attemptId' = a.id::text
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'abandoned'
    and sc.status <> 'cancelled' and room.status = 'active'
    and (
      (a.terminal_reason = 'permission_revoked')
      or (
        command.result->>'status' = 'abandoned'
        and m.status = 'active' and m.role in ('owner','admin','member')
      )
    )
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$function$;

CREATE OR REPLACE FUNCTION private.read_attempt_recovery (
  target_attempt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status, 'outcome', a.outcome,
    'lockVersion', a.lock_version,
    'deadlineAt', a.deadline_at,
    'deadlineReached', a.deadline_at is not null and clock_timestamp() >= a.deadline_at,
    'pendingReceiptId', (select receipt.id from private.answer_receipts receipt
      where receipt.attempt_id = a.id and not exists (
        select 1 from private.attempt_answers answer where answer.receipt_id = receipt.id
      ) order by receipt.received_at, receipt.id limit 1),
    'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'hasOpenInteraction', exists (select 1 from private.interaction_intervals interval_row
      where interval_row.attempt_id = a.id and interval_row.ended_at is null),
    'narrativeCursor', case when cv.mode = 'narrative' then jsonb_build_object(
      'currentChallengeItemId', (select interval_row.challenge_item_id
        from private.interaction_intervals interval_row
        where interval_row.attempt_id = a.id and interval_row.ended_at is null
        order by interval_row.started_at desc limit 1),
      'nextChallengeItemId', (select item.id
        from private.challenge_items item
        where item.challenge_version_id = a.challenge_version_id
          and not exists (select 1 from private.attempt_answers answer
            where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
        order by item.position limit 1)
    ) else null end,
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id
      and not exists (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'challengeMode', cv.mode,
    'timeTrial', case when cv.mode = 'time-trial' then private.time_trial_progress(a.id) end,
    'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer else null end,
    'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
      select sum(case
        when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
        when question.type = 'queens'
          and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
        else 0 end)::integer
      from private.attempt_answers answer
      join private.challenge_items item on item.id = answer.challenge_item_id
      join private.question_versions question on question.id = item.question_version_id
      where answer.attempt_id = a.id
    ), 0), 0) else null end,
    'terminalOutcome', case when cv.mode = 'survival' and (
      greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when question.type = 'queens'
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions question on question.id = item.question_version_id
        where answer.attempt_id = a.id
      ), 0), 0) = 0
    ) then 'eliminated' when cv.mode = 'survival' and not exists (
      select 1 from private.challenge_items item where item.challenge_version_id = a.challenge_version_id
        and not exists (select 1 from private.attempt_answers answer where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
    ) then 'survived'
      when cv.mode = 'pyramid' and exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then 'failed'
      when cv.mode = 'pyramid' and (
        select count(*) from private.attempt_answers answer where answer.attempt_id = a.id
      ) = 7 then 'summit'
      else null end,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
      'status', aa.status, 'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms,
      'resultDetails', aa.result_details, 'reviewState', aa.review_state) order by i.position)
      from private.attempt_answers aa join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)
  ) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive'
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_completed_attempt (
  target_attempt uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('scheduledChallengeId', sc.id, 'result',
    jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
      'status', a.status, 'score', a.score, 'outcome', a.outcome,
      'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end,
      'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case when answer.status in ('incorrect','unanswered','timeout') then 1
          when q.type = 'queens' and coalesce((answer.result_details->>'incorrectAttempts')::integer,0) > 0 then 1 else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions q on q.id = item.question_version_id where answer.attempt_id = a.id
      ),0),0) end,
      'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', answer.challenge_item_id,
        'answer', answer.answer, 'status', answer.status, 'points', answer.points,
        'timeUsedMs', answer.time_used_ms, 'resultDetails', answer.result_details,
        'reviewState', answer.review_state) order by item.position)
        from private.attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id), '[]'::jsonb))) ||
      jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome, 'terminalReason', a.terminal_reason,
        'timeTrial', case when cv.mode = 'time-trial' then private.time_trial_progress(a.id) end))
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled'
    and room.status = 'active' and m.status = 'active' and m.role in ('owner','admin','member')
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$function$;

CREATE OR REPLACE FUNCTION private.read_recorded_evaluation (
  target_receipt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare target_attempt uuid; result jsonb;
begin
  select r.attempt_id into target_attempt from private.answer_receipts r where r.id = target_receipt;
  if target_attempt is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
    'receiptId', answer.receipt_id, 'status', answer.status, 'points', answer.points,
    'details', answer.result_details, 'reviewState', answer.review_state)) into result
  from private.attempt_answers answer join public.attempts a on a.id = answer.attempt_id
  where answer.receipt_id = target_receipt;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_connect_pairs_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  snapshot jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths'
    ]))
    or jsonb_typeof(input->'paths') is distinct from 'object' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_connect_pairs_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  instant := clock_timestamp();
  if a.deadline_at is not null and instant >= a.deadline_at
    and exists (select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id and cv.mode = 'time-trial') then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'connect-pairs' or question.payload_schema_version <> 1
    or not private.connect_pairs_draft_valid(question.public_payload, jsonb_build_object('paths', input->'paths')) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  snapshot := jsonb_build_object('type', 'connect-pairs', 'paths', input->'paths');
  update public.attempts set
    progress_payload = jsonb_build_object('kind', 'connect-pairs', 'challengeItemId', item.id, 'paths', input->'paths'),
    lock_version = lock_version + 1,
    last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object('attemptId', a.id, 'challengeItemId', item.id,
    'lockVersion', a.lock_version, 'reviewState', snapshot);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_connect_pairs_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_connect_pairs_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_flash_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    review_state           jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    a.id, a.scheduled_challenge_id, aa.challenge_item_id, i.position, q.id,
    q.type, q.payload_schema_version, q.public_payload, qs.solution_payload, aa.answer,
    aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, a.score, a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id
    and a.player_id = private.current_player_id()
    and a.kind = 'competitive'
    and a.status = 'completed'
    and cv.mode = 'flash'
    and r.status = 'active'
    and m.player_id = private.current_player_id()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_flash_result"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_pyramid_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    review_state           jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.review_state, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and attempt.outcome in ('summit', 'failed')
    and version.mode = 'pyramid' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_pyramid_result"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_survival_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    review_state           jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.review_state, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and version.mode = 'survival' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_survival_result"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_time_trial_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    review_state           jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer,
    time_trial             jsonb
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    a.id, a.scheduled_challenge_id, i.id, i.position, q.id,
    q.type, q.payload_schema_version, case when aa.id is not null then q.public_payload end, case when aa.id is not null then qs.solution_payload end, aa.answer,
    aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, a.score, a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score, private.time_trial_progress(a.id)
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id
    and a.player_id = private.current_player_id()
    and a.kind = 'competitive'
    and a.status = 'completed'
    and cv.mode = 'time-trial'
    and r.status = 'active'
    and m.player_id = private.current_player_id()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_time_trial_result"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_room_member_review (
  target_room_slug      text,
  target_publication_id uuid,
  target_player_id      uuid
)
  RETURNS TABLE (
    room_id                uuid,
    room_slug              text,
    room_title             text,
    viewer_role            text,
    season_id              uuid,
    season_title           text,
    publication_id         uuid,
    publication_status     text,
    publication_closes_at  timestamp with time zone,
    challenge_id           uuid,
    challenge_slug         text,
    challenge_version_id   uuid,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_mode         text,
    challenge_max_score    integer,
    question_count         bigint,
    initial_lives          integer,
    player_id              uuid,
    display_name           text,
    avatar_path            text,
    attempt_id             uuid,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_duration_ms    bigint,
    attempt_lock_version   bigint,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    time_limit_ms          integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    review_state           jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    item_points            integer,
    has_persisted_answer   boolean,
    level_id               text,
    level_label            text,
    briefing_title         text,
    briefing_format        text,
    briefing_description   text,
    global_time_limit_ms   integer,
    alphabet_letter        text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select p.id as player_id, m.role as viewer_role, r.id as room_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), authorized_attempt as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      case when availability.status = 'available' then 'open' else availability.status end
        as publication_status,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      case when cv.mode in ('alphabet','time-trial') then cv.global_time_limit_ms end as global_time_limit_ms,
      (select count(*)::bigint from private.challenge_items item
        where item.challenge_version_id = cv.id) as question_count,
      case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end as initial_lives,
      a.id as attempt_id,
      a.status as attempt_status,
      a.score as attempt_score,
      a.outcome as attempt_outcome,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      (extract(epoch from (coalesce(a.completed_at, a.started_at) - case when cv.mode = 'time-trial' and a.deadline_at is not null then a.deadline_at - cv.global_time_limit_ms * interval '1 millisecond' else a.started_at end)) * 1000)::bigint
        as attempt_duration_ms,
      a.lock_version as attempt_lock_version,
      v.player_id as viewer_player_id
    from viewer v
    join public.rooms r on r.id = v.room_id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    cross join lateral (
      select private.publication_effective_status(
        sc.status, s.status, s.starts_at, s.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      ) as status
    ) availability
    where cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
      and cv.status in ('published', 'archived')
      and private.can_review_competitive_attempt(a.id)
  )
  select
    a.room_id, a.room_slug, a.room_title, a.viewer_role,
    a.season_id, a.season_title, a.publication_id, a.publication_status,
    a.publication_closes_at,
    a.challenge_id, a.challenge_slug, a.challenge_version_id, a.challenge_title,
    a.challenge_subtitle, a.challenge_description, a.challenge_mode,
    a.challenge_max_score, a.question_count, a.initial_lives, target_player_id,
    p.display_name, p.avatar_path,
    a.attempt_id, a.attempt_status, a.attempt_score, a.attempt_outcome,
    a.attempt_started_at, a.attempt_completed_at, a.attempt_duration_ms,
    a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms,
    case when a.challenge_mode in ('pyramid','time-trial') and aa.id is null then null else q.public_payload end,
    case when a.challenge_mode in ('pyramid','time-trial') and aa.id is null then null else qs.solution_payload end,
    aa.answer, aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points, aa.id is not null,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'levelId' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'label' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'title' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'format' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'description' end,
    a.global_time_limit_ms,
    case when a.challenge_mode = 'alphabet' then i.mode_config->>'letter' end
  from authorized_attempt a
  join public.players p on p.id = target_player_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  where a.challenge_mode <> 'survival' or aa.id is not null
  order by i.position
$function$;

REVOKE ALL ON FUNCTION "public"."get_room_member_review"(text, uuid, uuid) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "private"."attempt_answers"
  ADD CONSTRAINT "attempt_answers_review_state_check"
    CHECK
    (((review_state IS NULL) OR ((jsonb_typeof(review_state) = 'object'::text) AND ((((review_state ->> 'type'::text) = 'connect-pairs'::text) AND (jsonb_typeof((review_state ->
    'paths'::text)) = 'object'::text)) OR (((review_state ->> 'type'::text) = 'queens'::text) AND (jsonb_typeof((review_state -> 'queens'::text)) = 'array'::text))))));

REVOKE ALL ON FUNCTION "private"."attempt_review_state"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."attempt_review_state"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."connect_pairs_draft_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."connect_pairs_draft_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."save_connect_pairs_draft"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."save_connect_pairs_draft"(jsonb) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_my_flash_result"(uuid) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_pyramid_result"(uuid) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_survival_result"(uuid) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_my_time_trial_result"(uuid) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_room_member_review"(text, uuid, uuid) TO "authenticated", "postgres";
