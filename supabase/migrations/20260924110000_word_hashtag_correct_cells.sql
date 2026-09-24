begin;

create or replace function private.word_hashtag_progress(target_attempt uuid, target_item uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
  progress_payload jsonb;
  letters text[];
  solution text[];
  swap jsonb;
  from_cell integer;
  to_cell integer;
  moves_used integer := 0;
  correct_cells integer[] := array[]::integer[];
  index integer;
  temporary text;
  solved boolean := false;
begin
  select q.public_payload, qs.solution_payload, a.progress_payload
    into public_payload, solution_payload, progress_payload
    from public.attempts a
    join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
    join private.question_versions q on q.id = i.question_version_id
    join private.question_version_solutions qs on qs.question_version_id = q.id
    where a.id = target_attempt and i.id = target_item and q.type = 'word-hashtag';
  if public_payload is null or solution_payload is null then return null; end if;

  select array_agg(nullif(value #>> '{}', '') order by ordinality)
    into solution from jsonb_array_elements(private.word_hashtag_solution_letters(solution_payload)) with ordinality;
  letters := array_fill(null::text, array[25]);
  for index in 0..24 loop
    letters[index + 1] := nullif(public_payload->'initialLetters'->>index, '');
  end loop;
  for swap in select value from jsonb_array_elements(
    coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb)
  ) loop
    from_cell := (swap->>'fromCell')::integer;
    to_cell := (swap->>'toCell')::integer;
    if from_cell between 0 and 24 and to_cell between 0 and 24 then
      temporary := letters[from_cell + 1];
      letters[from_cell + 1] := letters[to_cell + 1];
      letters[to_cell + 1] := temporary;
    end if;
    moves_used := moves_used + 1;
  end loop;
  solved := true;
  for index in 1..25 loop
    if letters[index] is distinct from solution[index] then
      solved := false;
    elsif letters[index] is not null then
      correct_cells := array_append(correct_cells, index - 1);
    end if;
  end loop;
  return jsonb_build_object(
    'kind', 'word-hashtag',
    'letters', to_jsonb(letters),
    'swaps', coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb),
    'movesUsed', moves_used,
    'movesRemaining', greatest(0, (public_payload->>'maxMoves')::integer - moves_used),
    'correctCells', to_jsonb(correct_cells),
    'solved', solved
  );
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


commit;
