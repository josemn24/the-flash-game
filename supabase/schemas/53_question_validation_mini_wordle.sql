-- mini-wordle: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_mini_wordle_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
  return;
end;
$$;

alter function private.validate_mini_wordle_question_document(jsonb) owner to postgres;
revoke all on function private.validate_mini_wordle_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_mini_wordle_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  normalized text;
begin
  if question.payload_schema_version <> 1 then return false; end if;
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
  return false;
end;
$$;

alter function private.is_supported_mini_wordle_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_mini_wordle_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
