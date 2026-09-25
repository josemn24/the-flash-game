SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.is_supported_flash_question (
  target_question uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  question private.question_versions%rowtype;
  solution jsonb;
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  normalized text;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.status <> 'published' or question.payload_schema_version <> 1 then return false; end if;
  select solution_payload into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type = 'multiple-choice' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  if question.type = 'logic-code' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'clues') = 'array'
      and jsonb_array_length(question.public_payload->'clues') between 1 and 20
      and (question.public_payload->>'codeLength')::integer between 1 and 12
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'clues') clue
        where jsonb_typeof(clue->'code') is distinct from 'string'
          or jsonb_typeof(clue->'hint') is distinct from 'string'
          or char_length(clue->>'code') <> (question.public_payload->>'codeLength')::integer
          or clue->>'code' !~ '^[0-9]+$'
          or char_length(btrim(clue->>'hint')) not between 1 and 500)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and char_length(solution->>'correctAnswer') = (question.public_payload->>'codeLength')::integer
      and solution->>'correctAnswer' ~ '^[0-9]+$';
  end if;
  if question.type = 'progressive-clues' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'clues') = 'array'
      and jsonb_array_length(question.public_payload->'clues') between 1 and 20
      and jsonb_typeof(question.public_payload->'cluePenalty') = 'number'
      and (question.public_payload->>'cluePenalty')::numeric = trunc((question.public_payload->>'cluePenalty')::numeric)
      and (question.public_payload->>'cluePenalty')::integer between 0 and 50
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'clues') clue
        where jsonb_typeof(clue) is distinct from 'string'
          or char_length(btrim(clue #>> '{}')) not between 1 and 500)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and not exists (select 1 from jsonb_array_elements(solution->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      and not exists (
        select 1
        from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1
      )
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
  end if;
  if question.type = 'matching' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'leftItems') = 'array'
      and jsonb_typeof(question.public_payload->'rightItems') = 'array'
      and jsonb_array_length(question.public_payload->'leftItems') between 3 and 6
      and jsonb_array_length(question.public_payload->'rightItems') = jsonb_array_length(question.public_payload->'leftItems')
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'leftItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'rightItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'leftItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'rightItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'matches') = 'object'
      and (select count(*) from jsonb_object_keys(solution->'matches')) = jsonb_array_length(question.public_payload->'leftItems')
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where not (solution->'matches' ? (item->>'id')))
      and not exists (select 1 from jsonb_each_text(solution->'matches') match
        where not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
          where item->>'id' = match.value))
      and (select count(*) from jsonb_each_text(solution->'matches')) =
        (select count(distinct value) from jsonb_each_text(solution->'matches'));
  end if;
  if question.type = 'progressive-image' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and jsonb_typeof(question.public_payload->'surface'->'src') = 'string'
      and char_length(btrim(question.public_payload->'surface'->>'src')) between 10 and 1000
      and left(question.public_payload->'surface'->>'src', 9) = '/visuals/'
      and question.public_payload->'surface'->>'src' !~ '\s'
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and char_length(btrim(question.public_payload->'surface'->>'alt')) between 1 and 500
      and (question.public_payload->'surface'->>'width')::numeric = trunc((question.public_payload->'surface'->>'width')::numeric)
      and (question.public_payload->'surface'->>'width')::integer > 0
      and (question.public_payload->'surface'->>'height')::numeric = trunc((question.public_payload->'surface'->>'height')::numeric)
      and (question.public_payload->'surface'->>'height')::integer > 0
      and (question.public_payload->'surface'->>'fit' is null or question.public_payload->'surface'->>'fit' in ('cover', 'contain'))
      and (question.public_payload->>'revealDurationMs')::numeric = trunc((question.public_payload->>'revealDurationMs')::numeric)
      and (question.public_payload->>'revealDurationMs')::integer > 0
      and (question.public_payload->>'revealDurationMs')::integer < question.time_limit_ms
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and jsonb_typeof(solution->'solutionAlt') = 'string'
      and char_length(btrim(solution->>'solutionAlt')) between 1 and 500
      and not exists (select 1 from jsonb_array_elements(solution->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      and not exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1)
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
  end if;
  if question.type <> 'mini-wordle' or jsonb_typeof(solution) <> 'object' then return false; end if;
  expected_word_length := (question.public_payload->>'wordLength')::integer;
  max_attempts := (question.public_payload->>'maxAttempts')::integer;
  selected_dictionary_id := solution->>'dictionaryId';
  normalized := private.mini_wordle_normalize(solution->>'correctAnswer');
  return jsonb_typeof(question.public_payload) = 'object'
    and jsonb_typeof(question.public_payload->'question') = 'string'
    and expected_word_length in (4, 5)
    and max_attempts between 1 and 10
    and ((expected_word_length = 4 and selected_dictionary_id = 'es-general-4.v1')
      or (expected_word_length = 5 and selected_dictionary_id = 'es-general-5.v1'))
    and char_length(normalized) = expected_word_length
    and normalized ~ '^[A-ZÑ]+$'
    and jsonb_typeof(solution->'additionalGuesses') = 'array'
    and jsonb_array_length(solution->'additionalGuesses') <= 1000
    and not exists (select 1 from jsonb_array_elements(solution->'additionalGuesses') extra
      where jsonb_typeof(extra) is distinct from 'string')
    and not exists (select 1 from jsonb_array_elements(solution->'additionalGuesses') extra
      where char_length(private.mini_wordle_normalize(extra #>> '{}')) <> expected_word_length
        or private.mini_wordle_normalize(extra #>> '{}') !~ '^[A-ZÑ]+$'
        or private.mini_wordle_normalize(extra #>> '{}') = normalized
        or (select count(*) from jsonb_array_elements_text(solution->'additionalGuesses') values(value)
            where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(extra #>> '{}')) > 1)
    and not private.editorial_has_secret_key(question.public_payload);
end;
$function$;

CREATE OR REPLACE FUNCTION private.recover_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
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
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
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
      if question.type in ('mini-wordle', 'logic-code', 'progressive-clues', 'matching', 'progressive-image') and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id, null, instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_flash_editorial_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  challenge jsonb;
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  option_count integer;
  expected_word_length integer;
  max_attempts integer;
  code_length integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
begin
  if document is null or jsonb_typeof(document) is distinct from 'object'
    or not document ?& array['challenge', 'questions']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['challenge', 'questions'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  challenge := document->'challenge';
  if jsonb_typeof(challenge) is distinct from 'object'
    or not challenge ?& array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig']
    or exists (
      select 1 from jsonb_object_keys(challenge) key_name
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' <> 'flash'
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object' then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or jsonb_array_length(document->'questions') not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload'])
      ) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    question_slug := btrim(question->>'slug');
    if jsonb_typeof(question->'slug') is distinct from 'string'
      or char_length(question_slug) not between 1 and 120
      or question->>'type' not in ('multiple-choice', 'mini-wordle', 'logic-code', 'progressive-clues', 'matching', 'progressive-image')
      or question->'payloadSchemaVersion' <> '1'::jsonb
      or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
      or (question->>'timeLimitMs')::numeric <= 0
      or question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_typeof(question->'points') is distinct from 'number' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    question_points := (question->>'points')::numeric;
    if question_points <> trunc(question_points)
      or question_points <= 0
      or question_points > 100 then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    total_points := total_points + question_points::integer;
    seen_slugs := seen_slugs || question_slug;

    public_payload := question->'publicPayload';
    solution_payload := question->'solutionPayload';

    if question->>'type' = 'mini-wordle' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'wordLength', 'maxAttempts']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'hint', 'wordLength', 'maxAttempts'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'wordLength') is distinct from 'number'
        or (public_payload->>'wordLength')::integer not in (4, 5)
        or jsonb_typeof(public_payload->'maxAttempts') is distinct from 'number'
        or (public_payload->>'maxAttempts')::integer not between 1 and 10
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'additionalGuesses', 'dictionaryId']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'additionalGuesses', 'dictionaryId', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or jsonb_typeof(solution_payload->'additionalGuesses') is distinct from 'array'
        or jsonb_typeof(solution_payload->'dictionaryId') is distinct from 'string'
        or solution_payload->>'dictionaryId' not in ('es-general-4.v1', 'es-general-5.v1')
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      expected_word_length := (public_payload->>'wordLength')::integer;
      max_attempts := (public_payload->>'maxAttempts')::integer;
      selected_dictionary_id := solution_payload->>'dictionaryId';
      if (expected_word_length = 4 and selected_dictionary_id <> 'es-general-4.v1')
        or (expected_word_length = 5 and selected_dictionary_id <> 'es-general-5.v1')
        or char_length(private.mini_wordle_normalize(solution_payload->>'correctAnswer')) <> expected_word_length
        or private.mini_wordle_normalize(solution_payload->>'correctAnswer') !~ '^[A-ZÑ]+$'
        or jsonb_array_length(solution_payload->'additionalGuesses') > 1000
        or exists (select 1 from jsonb_array_elements(solution_payload->'additionalGuesses') extra
          where jsonb_typeof(extra) is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      solution_word := private.mini_wordle_normalize(solution_payload->>'correctAnswer');
      for guess_word in select value from jsonb_array_elements_text(solution_payload->'additionalGuesses') loop
        if char_length(private.mini_wordle_normalize(guess_word)) <> expected_word_length
          or private.mini_wordle_normalize(guess_word) !~ '^[A-ZÑ]+$'
          or private.mini_wordle_normalize(guess_word) = solution_word
          or (select count(*) from jsonb_array_elements_text(solution_payload->'additionalGuesses') values(value)
              where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(guess_word)) > 1 then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
      end loop;
      continue;
    end if;

    if question->>'type' = 'logic-code' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'codeLength']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'codeLength'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'codeLength') is distinct from 'number'
        or (public_payload->>'codeLength')::integer not between 1 and 12
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1
          from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'object'
            or not clue ?& array['code', 'hint']
            or exists (select 1 from jsonb_object_keys(clue) key_name where key_name <> all(array['code', 'hint']))
            or jsonb_typeof(clue->'code') is distinct from 'string'
            or char_length(clue->>'code') <> (public_payload->>'codeLength')::integer
            or clue->>'code' !~ '^[0-9]+$'
            or jsonb_typeof(clue->'hint') is distinct from 'string'
            or char_length(btrim(clue->>'hint')) not between 1 and 500
        )
        or (select count(distinct clue->>'code') from jsonb_array_elements(public_payload->'clues') clue)
           <> jsonb_array_length(public_payload->'clues') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(solution_payload->>'correctAnswer') <> (public_payload->>'codeLength')::integer
        or solution_payload->>'correctAnswer' !~ '^[0-9]+$'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-clues' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'cluePenalty']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'cluePenalty'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'cluePenalty') is distinct from 'number'
        or (public_payload->>'cluePenalty')::numeric <> trunc((public_payload->>'cluePenalty')::numeric)
        or (public_payload->>'cluePenalty')::integer not between 0 and 50
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'string'
            or char_length(btrim(clue #>> '{}')) not between 1 and 500
        ) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (
          select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500
        )
        or exists (
          select 1
          from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1
        )
        or not exists (
          select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'matching' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'leftItems', 'rightItems']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'leftItems', 'rightItems'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'leftItems') is distinct from 'array'
        or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
        or jsonb_array_length(public_payload->'leftItems') not between 3 and 6
        or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'leftItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'leftItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'rightItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'matches'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches', 'explanation']))
        or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
        or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
        or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value
        ))
        or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-image' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'revealDurationMs']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['src', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'src', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or jsonb_typeof(public_payload->'surface'->'src') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'src')) not between 10 and 1000
        or left(public_payload->'surface'->>'src', 9) <> '/visuals/'
        or public_payload->'surface'->>'src' ~ '\s'
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer <= 0
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer <= 0
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100))
        or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
        or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
        or (public_payload->>'revealDurationMs')::integer <= 0
        or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
        or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers', 'solutionAlt']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'solutionAlt', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'))
        or jsonb_typeof(solution_payload->'solutionAlt') is distinct from 'string'
        or char_length(btrim(solution_payload->>'solutionAlt')) not between 1 and 500
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'options']
      or exists (
        select 1 from jsonb_object_keys(public_payload) key_name
        where key_name <> all(array['category', 'tags', 'question', 'options', 'media', 'promptVisual'])
      )
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'options') is distinct from 'array'
      or jsonb_array_length(public_payload->'options') < 2
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'media' and jsonb_typeof(public_payload->'media') not in ('null', 'object'))
      or (public_payload ? 'promptVisual' and jsonb_typeof(public_payload->'promptVisual') not in ('null', 'object')) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    for option in select value from jsonb_array_elements(public_payload->'options') loop
      if jsonb_typeof(option) is distinct from 'string' or char_length(btrim(option #>> '{}')) = 0 then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
    end loop;
    select count(distinct value) into option_count from jsonb_array_elements_text(public_payload->'options');
    if option_count <> jsonb_array_length(public_payload->'options') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (
        select 1 from jsonb_object_keys(solution_payload) key_name
        where key_name <> all(array['correctAnswer', 'explanation'])
      )
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) = 0
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements_text(public_payload->'options') value
      where value = solution_payload->>'correctAnswer'
    ) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
  end loop;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_room_cards()
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    publication.competitive_playable,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count,
      (
        select count(*) between 2 and 20 and bool_and(private.is_supported_flash_question(q.id))
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status = 'published'
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$function$;

CREATE OR REPLACE FUNCTION public.get_room_introduction (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    membership_role      text,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    availability_status  text,
    can_start            boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select count(*) between 2 and 20 and bool_and(private.is_supported_flash_question(question.id))
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status = 'published'
  order by season.starts_at desc, schedule.number
$function$;
