-- E01 has its own command because a Mini-Wordle answer is a sequence of
-- authoritative events, not a single client-submitted answer payload.
create function private.submit_mini_wordle_guess(input jsonb) returns jsonb
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

alter function private.submit_mini_wordle_guess(jsonb) owner to postgres;
revoke all on function private.submit_mini_wordle_guess(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.submit_mini_wordle_guess(jsonb) to service_role;
