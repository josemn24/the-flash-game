-- Recover committed gameplay commands without duplicate effects. Existing facts remain unchanged.
begin;
set local check_function_bodies = off;

create or replace function private.authorize_attempt_replay(target_attempt uuid, token_hash text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.attempts a
    join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
    where a.id = target_attempt and a.player_id = private.current_player_id()
      and a.kind = 'competitive' and room.status = 'active' and sc.status <> 'cancelled'
      and m.status = 'active' and m.role in ('owner','admin','member')
      and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from private.attempt_sessions s
    where s.attempt_id = target_attempt and s.session_token_hash = token_hash and s.revoked_at is null)
  then raise exception 'session_revoked' using errcode = '42501'; end if;
end;
$$;

create or replace function private.prepare_attempt_session(target_publication uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.scheduled_challenges sc
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id
    where sc.id = target_publication and room.status = 'active'
      and m.player_id = private.current_player_id() and m.status = 'active'
      and m.role in ('owner','admin','member')
      and not exists (select 1 from private.platform_role_assignments where player_id = m.player_id)
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
end;
$$;

create or replace function private.read_recorded_evaluation(target_receipt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target_attempt uuid; result jsonb;
begin
  select r.attempt_id into target_attempt from private.answer_receipts r where r.id = target_receipt;
  if target_attempt is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
    'receiptId', answer.receipt_id, 'status', answer.status, 'points', answer.points,
    'details', answer.result_details)) into result
  from private.attempt_answers answer join public.attempts a on a.id = answer.attempt_id
  where answer.receipt_id = target_receipt;
  return result;
end;
$$;

create or replace function private.read_completed_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
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
        'timeUsedMs', answer.time_used_ms, 'resultDetails', answer.result_details) order by item.position)
        from private.attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id), '[]'::jsonb))))
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
$$;

create or replace function private.recover_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  cv private.challenge_versions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      select * into cv from private.challenge_versions where id = a.challenge_version_id;
      if cv.mode = 'alphabet' and instant < unit.deadline_at then
        update private.interaction_intervals
        set ended_at = greatest(segment.started_at, least(instant, unit.deadline_at)),
            end_reason = 'recovery_interrupted'
        where id = segment.id;
        result := jsonb_build_object('receiptId', null, 'recovered', true,
          'recoveryInterrupted', true, 'challengeItemId', segment.challenge_item_id);
      elsif cv.mode <> 'pyramid'
        and question.type in ('mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'word-search', 'word-hashtag', 'zip', 'escape')
        and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id,
          case when question.type = 'word-hashtag'
            then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
            else null end,
          instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$$;

create or replace function private.read_attempt_recovery(target_attempt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status,
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
      'resultDetails', aa.result_details) order by i.position)
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
$$;

create or replace function private.submit_mini_wordle_guess(input jsonb) returns jsonb
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
  solution private.question_version_solutions%rowtype;
  event private.mini_wordle_guess_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  attempts_used integer;
  max_attempts integer;
  expected_word_length integer;
  normalized_guess text;
  normalized_solution text;
  selected_dictionary_id text;
  feedback jsonb;
  solved boolean;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess','clientTimeUsedMs'
    ]))
    or input->>'guess' is null
  then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{guess}', to_jsonb(encode(sha256(convert_to(input->>'guess', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_mini_wordle_guess' or cached.input <> safe_input) then
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
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
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
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'mini-wordle' then raise exception 'unsupported_question' using errcode = '22023'; end if;

  expected_word_length := (question.public_payload->>'wordLength')::integer;
  max_attempts := (question.public_payload->>'maxAttempts')::integer;
  selected_dictionary_id := solution.solution_payload->>'dictionaryId';
  normalized_guess := private.mini_wordle_normalize(input->>'guess');
  normalized_solution := private.mini_wordle_normalize(solution.solution_payload->>'correctAnswer');
  if char_length(normalized_guess) <> expected_word_length or normalized_guess !~ '^[A-ZÑ]+$'
    or not (
      normalized_guess = normalized_solution
      or
      exists (select 1 from private.mini_wordle_dictionary_words d
        where d.dictionary_id = selected_dictionary_id and d.word_length = expected_word_length and d.word = normalized_guess)
      or exists (select 1 from jsonb_array_elements_text(solution.solution_payload->'additionalGuesses') extra(value)
        where private.mini_wordle_normalize(extra.value) = normalized_guess)
    ) then
    raise exception 'invalid_mini_wordle_guess' using errcode = '22023';
  end if;
  if exists (select 1 from private.mini_wordle_guess_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.guess = normalized_guess) then
    raise exception 'duplicate_mini_wordle_guess' using errcode = '55000';
  end if;
  select count(*)::integer into attempts_used from private.mini_wordle_guess_events
    where attempt_id = a.id and challenge_item_id = item.id;
  if attempts_used >= max_attempts then raise exception 'attempt_terminal' using errcode = '55000'; end if;

  feedback := private.mini_wordle_feedback(normalized_guess, normalized_solution);
  solved := normalized_guess = normalized_solution;
  terminal := solved or attempts_used + 1 >= max_attempts;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.mini_wordle_guess_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, guess, feedback, solved,
    received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, attempts_used + 1, normalized_guess, feedback, solved,
    instant, presented, used_ms, key)
  returning * into event;
  if terminal then
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id,
      jsonb_build_object('guesses', (select jsonb_agg(e.guess order by e.sequence)
        from private.mini_wordle_guess_events e where e.attempt_id = a.id and e.challenge_item_id = item.id)),
      instant, presented, effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'sequence', event.sequence, 'guess', event.guess, 'feedback', event.feedback,
    'attemptsUsed', event.sequence, 'maxAttempts', max_attempts, 'terminal', terminal,
    'timeUsedMs', used_ms);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_mini_wordle_guess', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'attemptsUsed', attempts_used),
      jsonb_build_object('lockVersion', a.lock_version, 'attemptsUsed', event.sequence, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_mini_wordle_guess', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_logic_code_attempt(input jsonb) returns jsonb
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
  solution private.question_version_solutions%rowtype;
  event private.logic_code_attempt_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  code_length integer;
  sequence_no integer;
  incorrect_attempts integer;
  normalized_code text;
  normalized_solution text;
  solved boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code','clientTimeUsedMs'
    ]))
    or input->>'code' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{code}', to_jsonb(encode(sha256(convert_to(input->>'code', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_logic_code_attempt' or cached.input <> safe_input) then
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
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'logic-code' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  code_length := (question.public_payload->>'codeLength')::integer;
  normalized_code := btrim(input->>'code');
  normalized_solution := solution.solution_payload->>'correctAnswer';
  if code_length not between 1 and 12
    or char_length(normalized_code) <> code_length
    or normalized_code !~ '^[0-9]+$'
    or char_length(normalized_solution) <> code_length
    or normalized_solution !~ '^[0-9]+$' then
    raise exception 'invalid_logic_code' using errcode = '22023';
  end if;
  if exists (select 1 from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.code = normalized_code) then
    raise exception 'duplicate_logic_code' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  solved := normalized_code = normalized_solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.logic_code_attempt_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, code, correct,
    penalty_applied, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized_code, solved,
    not solved, instant, presented, used_ms, key)
  returning * into event;
  if not solved then
    incorrect_attempts := sequence_no;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', false, 'terminal', false,
      'incorrectAttempts', incorrect_attempts);
  else
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    incorrect_attempts := (select count(*)::integer from private.logic_code_attempt_events e
      where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct);
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, to_jsonb(event.code), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', true, 'terminal', true,
      'incorrectAttempts', incorrect_attempts, 'receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_set(result, '{lockVersion}', to_jsonb(a.lock_version));
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_logic_code_attempt', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'sequence', event.sequence, 'terminal', solved));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_logic_code_attempt', safe_input, result);
  return result;
end;
$$;

create or replace function private.reveal_progressive_clue(input jsonb) returns jsonb
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
  event private.progressive_clue_reveal_events%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  total_clues integer;
  next_index integer;
  effective_penalty integer;
  available_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'reveal_progressive_clue' or cached.input <> safe_input) then
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
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;

  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
  total_clues := jsonb_array_length(question.public_payload->'clues');
  select coalesce(max(e.clue_index), 0) + 1 into next_index
    from private.progressive_clue_reveal_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  if next_index > total_clues then
    raise exception 'all_clues_revealed' using errcode = '55000';
  end if;

  effective_penalty := private.progressive_clue_effective_penalty(
    (question.public_payload->>'cluePenalty')::integer,
    item.points
  );
  available_points := greatest(0, item.points - effective_penalty * (next_index - 1));
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, next_index,
    effective_penalty, available_points, instant, key
  ) returning * into event;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'challengeItemId', item.id,
    'lockVersion', a.lock_version,
    'clueIndex', event.clue_index,
    'clue', question.public_payload->'clues'->>(event.clue_index - 1),
    'revealedClues', event.clue_index,
    'totalClues', total_clues,
    'availablePoints', event.available_points,
    'cluePenalty', event.penalty_points
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'reveal_progressive_clue', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'clueIndex', event.clue_index,
        'availablePoints', event.available_points));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'reveal_progressive_clue', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_queens_placement(input jsonb) returns jsonb
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
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
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
$$;

create or replace function private.save_queens_draft(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
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
    raise exception 'invalid_queens_answer' using errcode = '22023';
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
    'solved', progress->'solved');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_queens_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_queens_draft', safe_input, result);
  return result;
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
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
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
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if coalesce(array_length(candidate, 1), 0) <> board_size then
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
  if coalesce(array_length(normalized, 1), 0) <> board_size then
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
  if correct then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  select count(*)::integer into incorrect_attempts
    from private.queens_validation_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'correct', correct, 'terminal', correct, 'queens', progress->'queens',
    'placedQueens', progress->'placedQueens', 'completedRows', progress->'completedRows',
    'completedColumns', progress->'completedColumns', 'completedRegions', progress->'completedRegions',
    'conflictingQueens', progress->'conflictingQueens', 'solved', progress->'solved',
    'incorrectAttempts', incorrect_attempts);
  if correct then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_answer', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'queens', to_jsonb(normalized)),
      jsonb_build_object('lockVersion', a.lock_version, 'correct', correct, 'incorrectAttempts', incorrect_attempts));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_answer', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_word_hashtag_swap(input jsonb)
returns jsonb
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
  solution private.question_version_solutions%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  from_cell integer;
  to_cell integer;
  max_moves integer;
  current_progress jsonb;
  next_progress jsonb;
  state jsonb;
  letters jsonb;
  solution_letters jsonb;
  next_letters jsonb;
  terminal boolean;
  solved boolean := false;
  correct_cells integer[] := array[]::integer[];
  next_moves_used integer;
  next_moves_remaining integer;
  index integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'fromCell') is distinct from 'number'
    or jsonb_typeof(input->'toCell') is distinct from 'number'
    or (input->>'fromCell')::numeric <> trunc((input->>'fromCell')::numeric)
    or (input->>'toCell')::numeric <> trunc((input->>'toCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  from_cell := (input->>'fromCell')::integer;
  to_cell := (input->>'toCell')::integer;
  if from_cell not between 0 and 24 or to_cell not between 0 and 24 or from_cell = to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_hashtag_swap' or cached.input <> safe_input) then
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
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-hashtag' or question.payload_schema_version <> 1
    or not private.word_hashtag_content_valid(question.public_payload, solution.solution_payload) then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  max_moves := (question.public_payload->>'maxMoves')::integer;
  current_progress := coalesce(a.progress_payload, jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', '[]'::jsonb)));
  if current_progress->>'kind' <> 'word-hashtag' or current_progress->>'challengeItemId' <> item.id::text then
    raise exception 'invalid_progress' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)) >= max_moves then
    raise exception 'word_hashtag_moves_exhausted' using errcode = '55000';
  end if;
  state := private.word_hashtag_progress(a.id, item.id);
  letters := state->'letters';
  solution_letters := private.word_hashtag_solution_letters(solution.solution_payload);
  if ((from_cell / 5) not in (1, 3) and (from_cell % 5) not in (1, 3))
    or ((to_cell / 5) not in (1, 3) and (to_cell % 5) not in (1, 3))
    or letters->from_cell is null or letters->to_cell is null
    or letters->from_cell = letters->to_cell
    or letters->from_cell = solution_letters->from_cell
    or letters->to_cell = solution_letters->to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  next_progress := jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('fromCell', from_cell, 'toCell', to_cell))));
  next_letters := jsonb_set(
    jsonb_set(letters, array[from_cell::text], letters->to_cell),
    array[to_cell::text], letters->from_cell
  );
  next_moves_used := (state->>'movesUsed')::integer + 1;
  next_moves_remaining := greatest(0, max_moves - next_moves_used);
  terminal := next_moves_used >= max_moves;
  solved := true;
  for index in 0..24 loop
    if (next_letters->index) is distinct from (solution_letters->index) then
      solved := false;
    elsif (next_letters->index) <> 'null'::jsonb then
      correct_cells := array_append(correct_cells, index);
    end if;
  end loop;
  terminal := terminal or solved;
  if terminal then
    update public.attempts
      set progress_payload = null, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  else
    update public.attempts
      set progress_payload = next_progress, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  end if;
  select * into a from public.attempts where id = a.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = item.id;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, next_progress->'answer', instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
  end if;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'letters', next_letters, 'movesUsed', next_moves_used,
    'movesRemaining', next_moves_remaining, 'correctCells', to_jsonb(correct_cells), 'terminal', terminal);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_hashtag_swap', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'movesUsed', next_moves_used, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_hashtag_swap', safe_input, result);
  return result;
end;
$$;

create or replace function private.submit_word_search_selection(input jsonb) returns jsonb
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
  solution private.question_version_solutions%rowtype;
  event private.word_search_selection_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  start_cell_i integer;
  end_cell_i integer;
  target_id text;
  total_words integer;
  grid_rows integer;
  grid_columns integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  terminal boolean;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'startCell') is distinct from 'number'
    or jsonb_typeof(input->'endCell') is distinct from 'number'
    or (input->>'startCell')::numeric <> trunc((input->>'startCell')::numeric)
    or (input->>'endCell')::numeric <> trunc((input->>'endCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  start_cell_i := (input->>'startCell')::integer;
  end_cell_i := (input->>'endCell')::integer;
  if start_cell_i < 0 or end_cell_i < 0 or start_cell_i = end_cell_i then
    raise exception 'invalid_word_search_selection' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_search_selection' or cached.input <> safe_input) then
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
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-search' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(question.public_payload->'letters') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'targets') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'positionsByTargetId') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  total_words := jsonb_array_length(question.public_payload->'targets');
  grid_rows := (question.public_payload->'grid'->>'rows')::integer;
  grid_columns := (question.public_payload->'grid'->>'columns')::integer;

  select positions.key into target_id
  from jsonb_each(solution.solution_payload->'positionsByTargetId') positions
  where (positions.value->>'startCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'endCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'startCell')::integer <> (positions.value->>'endCell')::integer
  limit 1;
  if target_id is null then
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i >= grid_rows * grid_columns or end_cell_i >= grid_rows * grid_columns
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_word_search_selection' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id
      and e.correct and e.matched_target_id = target_id) then
    raise exception 'word_search_target_already_found' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;

  insert into private.word_search_selection_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    start_cell, end_cell, matched_target_id, correct,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    start_cell_i, end_cell_i, target_id, target_id is not null,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.word_search_progress(a.id, item.id);
  terminal := (progress->>'foundCount')::integer = total_words;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id, jsonb_build_object('foundWordIds', progress->'foundWordIds'), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'startCell', event.start_cell, 'endCell', event.end_cell,
    'correct', event.correct, 'terminal', terminal,
    'matchedTargetId', event.matched_target_id,
    'foundSelections', progress->'foundSelections', 'foundWordIds', progress->'foundWordIds',
    'foundCount', progress->'foundCount', 'totalWords', progress->'totalWords',
    'incorrectAttempts', progress->'incorrectAttempts'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_search_selection', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'startCell', event.start_cell,
        'endCell', event.end_cell, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_search_selection', safe_input, result);
  return result;
end;
$$;

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
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  unit private.attempt_timing_units%rowtype;
  segment private.interaction_intervals%rowtype;
  prepared private.prepared_interactions%rowtype;
  receipt private.answer_receipts%rowtype;
  session_row private.attempt_sessions%rowtype;
  item private.challenge_items%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  points integer;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  resumed boolean := false;
  control_required boolean := false;
  is_admin boolean;
  clear_progress boolean := false;
  target_status text;
  completion_outcome text;
  survival_lives integer;
  survival_mistakes integer;
  survival_resolved integer;
  survival_total integer;
  pyramid_resolved integer;
  pyramid_total integer;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'start' then
    target := (input->>'scheduledChallengeId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
    if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = target for share;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
    if cached_result is not null then
      perform private.authorize_attempt_replay(a.id, safe_input->>'sessionToken');
      return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    if found then
      if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
      resumed := true;
      select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
      control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
    else
      insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
      values(actor, target, sc.challenge_version_id, 'competitive', 1)
      returning * into a;
      insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
        values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
    end if;
    target := a.id;
    result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
      'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
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
        if not found or (session_row.revoked_at is not null and not (
          op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')
        )) then raise exception 'session_revoked' using errcode = '42501'; end if;
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
    if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
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
        if a.deadline_at is not null and instant >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
          values(a.id, safe_input->>'newSessionToken', a.deadline_at) returning * into session_row;
        result := jsonb_build_object('sessionId', session_row.id, 'deadlineAt', a.deadline_at);
      when 'prepare' then
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
                case cv.mode when 'alphabet' then 'attempt' else 'question' end,
                case when cv.mode = 'alphabet' then a.started_at else instant end,
                case when cv.mode = 'alphabet' then a.deadline_at else instant + q.time_limit_ms * interval '1 millisecond' end
              from private.question_versions q where q.id = item.question_version_id returning * into unit;
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
      when 'activate' then
        if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
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
      when 'receive', 'pass' then
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
          raise exception 'interaction_not_presented' using errcode = '55000';
        end if;
        select * into item from private.challenge_items where id = segment.challenge_item_id;
        select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
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
      when 'evaluate' then
        select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
          raise exception 'already_evaluated' using errcode = '55000';
        end if;
        -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
          status, answer, result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
          input->>'status', receipt.answer, input->'resultDetails',
          case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
        result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status',
          'points', case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end);
      when 'complete', 'abandon' then
        if op = 'complete' then
          if cv.mode = 'alphabet' then
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
            if private.next_attempt_item(a.id) is not null then
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
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
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
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
          elsif cv.mode = 'alphabet' then
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
            completion_outcome := input->>'outcome';
          else
            if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
              raise exception 'incomplete_challenge' using errcode = '55000';
            end if;
            points := (input->>'score')::integer;
            completion_outcome := input->>'outcome';
          end if;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        delete from private.prepared_interactions where attempt_id = a.id;
        update public.attempts set status = target_status, score = points, completed_at = instant,
          outcome = completion_outcome, progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        if op = 'complete' then
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
        end if;
        result := jsonb_build_object('status', a.status, 'score', a.score,
          'outcome', a.outcome,
          'livesRemaining', case when cv.mode = 'survival' then survival_lives else null end);
        if op = 'complete' and cv.mode = 'alphabet' then
          result := result || jsonb_build_object('answers', coalesce((
            select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
              'answer', aa.answer, 'status', aa.status, 'points', aa.points,
              'timeUsedMs', aa.time_used_ms, 'resultDetails', aa.result_details) order by ci.position)
            from private.attempt_answers aa join private.challenge_items ci on ci.id = aa.challenge_item_id
            where aa.attempt_id = a.id
          ), '[]'::jsonb));
        end if;
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

alter function private.prepare_attempt_session(uuid) owner to postgres;
alter function private.read_recorded_evaluation(uuid, text) owner to postgres;
alter function private.read_completed_attempt(uuid) owner to postgres;
revoke all on function private.prepare_attempt_session(uuid), private.read_recorded_evaluation(uuid, text),
  private.read_completed_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function private.prepare_attempt_session(uuid), private.read_recorded_evaluation(uuid, text),
  private.read_completed_attempt(uuid) to service_role;

alter function private.authorize_attempt_replay(uuid, text) owner to postgres;
revoke all on function private.authorize_attempt_replay(uuid, text) from public, anon, authenticated, service_role;

-- A lost abandonment confirmation must also be recoverable after controller revocation.
-- Return its original command result; inactivity expiry has no abandonment command to replay.
create or replace function private.read_abandoned_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scheduledChallengeId', a.scheduled_challenge_id, 'result', command.result)
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  join private.command_requests command on command.actor_id = a.player_id
    and command.operation = 'abandon' and command.input->>'attemptId' = a.id::text
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'abandoned' and command.result->>'status' = 'abandoned'
    and sc.status <> 'cancelled' and room.status = 'active'
    and m.status = 'active' and m.role in ('owner','admin','member')
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;
alter function private.read_abandoned_attempt(uuid) owner to postgres;
revoke all on function private.read_abandoned_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function private.read_abandoned_attempt(uuid) to service_role;

commit;
