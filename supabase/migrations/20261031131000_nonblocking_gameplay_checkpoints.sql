set local check_function_bodies = off;

create or replace function private.handle_attempt_command(
  op text,
  input jsonb,
  safe_input jsonb,
  actor uuid,
  cached_result jsonb,
  received_at timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  operation_outcome record;
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  is_admin boolean;
  clear_progress boolean := false;
  allow_stale_timeout boolean := false;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'start' then
    return private.handle_attempt_start(input, safe_input, actor, cached_result, is_admin);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op = 'takeover' and a.scheduled_challenge_id <> (input->>'scheduledChallengeId')::uuid then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if op not in ('invalidate','adjust') then
      if a.player_id <> actor or a.kind <> 'competitive' or is_admin or not exists (
        select 1 from public.seasons s join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id
        where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
          and m.status = 'active' and m.role in ('owner','admin','member')
      ) then raise exception 'not_authorized' using errcode = '42501'; end if;
      if op <> 'takeover' then
        select * into session_row from private.attempt_sessions where attempt_id = a.id
          and session_token_hash = safe_input->>'sessionToken';
        if not found then
          raise exception 'session_revoked' using errcode = '42501';
        elsif session_row.revoked_at is not null then
          if session_row.revocation_reason = 'takeover' then
            raise exception 'session_transferred' using errcode = '42501';
          end if;
          if not (op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')) then
            raise exception 'session_revoked' using errcode = '42501';
          end if;
        end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached_result is not null then return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    expected := (input->>'lockVersion')::bigint;
    if expected is distinct from a.lock_version then
      allow_stale_timeout := expected < a.lock_version and (
        (op = 'receive' and input->'answer' = 'null'::jsonb and exists (
          select 1 from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and received >= unit.deadline_at
        )) or
        (op = 'receive' and input->'answer' <> 'null'::jsonb and exists (
          select 1
          from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          join private.challenge_items item on item.id = ix.challenge_item_id
          join private.question_versions question on question.id = item.question_version_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and ix.challenge_item_id = (input->>'challengeItemId')::uuid
            and question.type = 'connect-pairs'
            and received < unit.deadline_at
            and (cv.mode <> 'time-trial' or received < a.deadline_at)
        )) or
        (op = 'complete' and cv.mode = 'time-trial' and a.deadline_at is not null
          and received >= a.deadline_at
          and private.time_trial_progress(a.id)->>'endReason' = 'time_limit')
      );
      if not allow_stale_timeout then
        raise exception 'stale_version' using errcode = '40001';
      end if;
    end if;
    if op not in ('invalidate','adjust') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        select * into operation_outcome from private.handle_attempt_takeover(input, safe_input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'prepare' then
        select * into operation_outcome from private.handle_attempt_prepare(a, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'activate' then
        if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
        select * into operation_outcome from private.handle_attempt_activate(input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'receive', 'pass' then
        select * into operation_outcome from private.handle_attempt_submission(op, input, a, cv, instant, received);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'evaluate' then
        select * into operation_outcome from private.handle_attempt_evaluation(input, a, cv);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'complete', 'abandon' then
        select * into operation_outcome from private.handle_attempt_closure(op, input, a, sc, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'invalidate', 'adjust' then
        result := private.handle_attempt_admin_command(op, input, actor, a, sc, instant, key);
        select * into a from public.attempts where id = a.id;
    end case;
    if op not in ('complete','abandon','invalidate','adjust') then
      update public.attempts
        set lock_version = lock_version + 1,
            last_activity_at = instant,
            progress_payload = case when clear_progress then null else progress_payload end
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
    if cv.mode = 'time-trial' then
      result := result || jsonb_build_object('timeTrial', private.time_trial_progress(a.id), 'terminalReason', a.terminal_reason);
    end if;
  end if;

  return jsonb_build_object(
    'result', result,
    'entityType', 'attempt',
    'entityId', a.id,
    'beforePayload', previous,
    'replayed', false
  );
end;
$$;

create or replace function private.submit_queens_answer(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  challenge_mode text;
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
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  instant := clock_timestamp();
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if expected is distinct from a.lock_version and not (
    expected = a.lock_version - 1
    and instant < unit.deadline_at
    and (a.deadline_at is null or not exists (
      select 1 from private.challenge_versions cv
      where cv.id = a.challenge_version_id and cv.mode = 'time-trial'
    ) or instant < a.deadline_at)
  ) then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  instant := clock_timestamp();
  if exists (select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id and cv.mode = 'time-trial') and instant >= a.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
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
  select mode into challenge_mode from private.challenge_versions where id = a.challenge_version_id;
  penalty_points := case when correct or challenge_mode = 'time-trial' then 0 else round(item.points * 0.05)::integer end;
  insert into private.queens_validation_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, queens, correct,
    conflicting_queens, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized, correct,
    (progress->>'conflictingQueens')::integer, not correct and challenge_mode <> 'time-trial', penalty_points,
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
  if challenge_mode = 'time-trial' then result := result || jsonb_build_object('timeTrial', private.time_trial_progress(a.id)); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_answer', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'queens', to_jsonb(normalized)),
      jsonb_build_object('lockVersion', a.lock_version, 'correct', correct, 'incorrectAttempts', incorrect_attempts));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_answer', safe_input, result);
  return result;
end;
$$;
