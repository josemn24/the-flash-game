-- Queens: three failed board validations per Pyramid level.
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.queens_progress (
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
  regions jsonb;
  draft jsonb;
  queens integer[];
  board_size integer;
  conflicting_queens integer;
  completed_rows integer;
  completed_columns integer;
  completed_regions integer;
  solved boolean;
  incorrect_validations integer;
  max_incorrect_validations integer;
begin
  select q.public_payload->'regions', (q.public_payload->'grid'->>'rows')::integer, a.progress_payload,
    case when cv.mode = 'pyramid' then 3 else null end
    into regions, board_size, draft, max_incorrect_validations
  from public.attempts a
  join private.challenge_items i on i.id = target_item
  join private.question_versions q on q.id = i.question_version_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt;

  if jsonb_typeof(draft) = 'object'
    and draft->>'kind' = 'queens'
    and (draft->>'challengeItemId')::uuid = target_item
    and jsonb_typeof(draft->'queens') = 'array' then
    select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
      into queens
    from jsonb_array_elements_text(draft->'queens') value;
  else
    queens := private.queens_board(target_attempt, target_item);
  end if;

  with pairs as (
    select left_cell as cell, right_cell
    from unnest(queens) left_cell
    cross join unnest(queens) right_cell
    where left_cell < right_cell
  ), conflicts as (
    select p.cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
    union
    select p.right_cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
  )
  select count(*)::integer into conflicting_queens from conflicts;

  select count(*)::integer into completed_rows
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell / board_size = group_no) = 1;
  select count(*)::integer into completed_columns
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell % board_size = group_no) = 1;
  select count(*)::integer into completed_regions
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where (regions->cell)::integer = group_no) = 1;

  solved := coalesce(array_length(queens, 1), 0) = board_size
    and completed_rows = board_size
    and completed_columns = board_size
    and completed_regions = board_size
    and conflicting_queens = 0;

  select count(*)::integer into incorrect_validations
  from private.queens_validation_events e
  where e.attempt_id = target_attempt and e.challenge_item_id = target_item and not e.correct;

  return jsonb_build_object(
    'kind', 'queens',
    'incorrectValidations', incorrect_validations,
    'maxIncorrectValidations', max_incorrect_validations,
    'queens', to_jsonb(queens),
    'placedQueens', coalesce(array_length(queens, 1), 0),
    'completedRows', completed_rows,
    'completedColumns', completed_columns,
    'completedRegions', completed_regions,
    'conflictingQueens', conflicting_queens,
    'solved', solved
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_queens_draft (
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
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_queens_draft' or cached.input <> safe_input) then
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
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id, 'queens', to_jsonb(normalized)),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  progress := private.queens_progress(a.id, item.id);
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved',
    'incorrectValidations', progress->'incorrectValidations',
    'maxIncorrectValidations', progress->'maxIncorrectValidations');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_queens_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_queens_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_queens_answer (
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
  validation private.queens_validation_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  solution integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  correct boolean;
  terminal boolean;
  sequence_no integer;
  incorrect_attempts integer;
  penalty_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_answer' or cached.input <> safe_input) then
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
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  instant := clock_timestamp();
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if coalesce(array_length(candidate, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(candidate, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'queens_answer_overflow' using errcode = '22023';
  end if;
  if coalesce(array_length(normalized, 1), 0) < board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into solution
  from private.question_version_solutions qs
  cross join jsonb_array_elements_text(qs.solution_payload->'solution') value
  where qs.question_version_id = question.id;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id, 'queens', to_jsonb(normalized)),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id;
  progress := private.queens_progress(a.id, item.id);
  correct := (progress->>'solved')::boolean and normalized = solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_validation_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  penalty_points := case when correct then 0 else round(item.points * 0.05)::integer end;
  insert into private.queens_validation_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, queens, correct,
    conflicting_queens, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized, correct,
    (progress->>'conflictingQueens')::integer, not correct, penalty_points,
    instant, presented, used_ms, key)
  returning * into validation;
  progress := private.queens_progress(a.id, item.id);
  incorrect_attempts := (progress->>'incorrectValidations')::integer;
  terminal := correct or coalesce(incorrect_attempts >= (progress->>'maxIncorrectValidations')::integer, false);
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'correct', correct, 'terminal', terminal, 'queens', progress->'queens',
    'placedQueens', progress->'placedQueens', 'completedRows', progress->'completedRows',
    'completedColumns', progress->'completedColumns', 'completedRegions', progress->'completedRegions',
    'conflictingQueens', progress->'conflictingQueens', 'solved', progress->'solved',
    'incorrectAttempts', incorrect_attempts,
    'incorrectValidations', incorrect_attempts,
    'maxIncorrectValidations', progress->'maxIncorrectValidations');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_answer', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'queens', to_jsonb(normalized)),
      jsonb_build_object('lockVersion', a.lock_version, 'correct', correct, 'incorrectAttempts', incorrect_attempts));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_answer', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_queens_placement (
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
  event private.queens_placement_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  cell integer;
  action text;
  current_queens integer[];
  next_queens integer[];
  progress jsonb;
  conflicting boolean;
  penalty boolean;
  penalty_points integer;
  sequence_no integer;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action'
    ]))
    or jsonb_typeof(input->'cell') is distinct from 'number'
    or (input->>'cell')::numeric <> trunc((input->>'cell')::numeric)
    or input->>'action' not in ('place', 'remove') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  cell := (input->>'cell')::integer;
  action := input->>'action';
  if cell not between 0 and 24 then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_placement' or cached.input <> safe_input) then
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
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  if exists (select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id and cv.mode = 'pyramid') then
    raise exception 'queens_requires_board_validation' using errcode = '22023';
  end if;

  current_queens := private.queens_board(a.id, item.id);
  if action = 'remove' and cell = any(coalesce((select array_agg(value::integer) from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value), '{}'::integer[])) then
    raise exception 'prefilled_queen_locked' using errcode = '55000';
  end if;
  if action = 'place' and cell = any(current_queens) then raise exception 'duplicate_queens_placement' using errcode = '55000'; end if;
  if action = 'remove' and not cell = any(current_queens) then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  next_queens := case when action = 'place' then current_queens || cell else array_remove(current_queens, cell) end;
  conflicting := action = 'place' and private.queens_cell_conflicts(question.public_payload->'regions', cell, next_queens);
  penalty := conflicting;
  penalty_points := case when penalty then round(item.points * 0.05)::integer else 0 end;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_placement_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  insert into private.queens_placement_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, cell, action,
    conflicting, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, cell, action,
    conflicting, penalty, penalty_points, instant, presented, used_ms, key)
  returning * into event;
  progress := private.queens_progress(a.id, item.id);
  terminal := (progress->>'solved')::boolean;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'cell', event.cell, 'action', event.action, 'conflicting', event.conflicting,
    'penaltyApplied', event.penalty_applied, 'terminal', terminal,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_placement', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'cell', cell, 'action', action),
      jsonb_build_object('lockVersion', a.lock_version, 'terminal', terminal, 'penaltyApplied', penalty));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_placement', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_evaluation_context (
  target_receipt uuid,
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
  select jsonb_build_object(
    'receiptId', r.id, 'answer', case when q.type = 'queens' then private.queens_answer(r.attempt_id, r.challenge_item_id) when q.type = 'word-search' then jsonb_build_object('foundWordIds', coalesce((
      select jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '[]'::jsonb)) else r.answer end, 'receivedAt', r.received_at,
    'timeUsedMs', r.time_used_ms, 'timedOut', r.timed_out,
    'questionVersionId', q.id, 'questionType', q.type, 'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', q.public_payload,
    'submittedCodes', case when q.type = 'logic-code' then coalesce((
      select jsonb_agg(e.code order by e.sequence)
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), '[]'::jsonb) else null end,
    'progressiveCluesRevealed', case when q.type = 'progressive-clues' then coalesce((
      select max(e.clue_index)::integer
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), 1) else null end,
    'progressiveClueAvailablePoints', case when q.type = 'progressive-clues' then coalesce((
      select e.available_points
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
      order by e.clue_index desc
      limit 1
    ), i.points) else null end,
    'incorrectAttempts', case when q.type = 'logic-code' then coalesce((
      select count(*)::integer
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) when q.type = 'queens' then coalesce((
      select count(*)::integer
      from private.queens_validation_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) + coalesce((
      select count(*)::integer
      from private.queens_placement_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.penalty_applied
    ), 0) when q.type = 'word-search' then coalesce((
      select count(*)::integer from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'incorrectValidations', case when q.type = 'queens' then (private.queens_progress(r.attempt_id, r.challenge_item_id)->>'incorrectValidations')::integer else null end,
    'solutionPayload', qs.solution_payload, 'timeLimitMs', q.time_limit_ms,
    'itemPoints', i.points, 'itemConfigSchemaVersion', i.config_schema_version,
    'itemConfig', i.mode_config, 'mode', cv.mode,
    'modeConfigSchemaVersion', cv.config_schema_version, 'modeConfig', cv.mode_config)
  into result from private.answer_receipts r
  join public.attempts a on a.id = r.attempt_id
  join private.attempt_sessions s on s.attempt_id = a.id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = actor
  join private.challenge_items i on i.id = r.challenge_item_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  where r.id = target_receipt and a.player_id = actor and a.status = 'in_progress'
    and a.kind = 'competitive' and sc.status <> 'cancelled' and room.status = 'active'
    and m.status = 'active' and m.role in ('owner', 'admin', 'member')
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;
