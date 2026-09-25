-- Shared question eligibility used by room projections and competitive flows.
-- Later format and mode helpers are resolved after the declarative schema is loaded.
set local check_function_bodies = off;

create function private.is_supported_flash_question(target_question uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  question private.question_versions%rowtype;
  solution jsonb;
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  normalized text;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.status <> 'published' then return false; end if;
  select solution_payload into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type = 'progressive-image' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and question.public_payload->'surface'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'surface'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'surface'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'surface'->'height') = 'number'
      and (question.public_payload->'surface'->>'width')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'height')::integer between 1 and 8192
      and jsonb_typeof(question.public_payload->'revealDurationMs') = 'number'
      and (question.public_payload->>'revealDurationMs')::integer between 1 and question.time_limit_ms - 1
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_typeof(solution->'solutionAlt') = 'string'
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where private.mini_wordle_normalize(answer) = private.mini_wordle_normalize(solution->>'correctAnswer'));
  end if;
  if question.type = 'multiple-choice' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and jsonb_typeof(question.public_payload->'media') = 'object'
      and question.public_payload->'media'->>'type' = 'image'
      and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
      and (question.public_payload->'media'->>'width')::integer between 1 and 8192
      and (question.public_payload->'media'->>'height')::integer between 1 and 8192
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  if question.type = 'estimation' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'min') = 'number'
      and jsonb_typeof(question.public_payload->'max') = 'number'
      and jsonb_typeof(question.public_payload->'step') = 'number'
      and jsonb_typeof(question.public_payload->'initialValue') = 'number'
      and (question.public_payload->>'min')::numeric < (question.public_payload->>'max')::numeric
      and (question.public_payload->>'step')::numeric > 0
      and (question.public_payload->>'initialValue')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(question.public_payload->'unit') = 'string'
      and char_length(btrim(question.public_payload->>'unit')) between 1 and 120
      and jsonb_typeof(question.public_payload->'media') in ('null', 'object')
      and (
        jsonb_typeof(question.public_payload->'media') = 'null'
        or (
          question.public_payload->'media'->>'type' = 'image'
          and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
          and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
          and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
          and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
          and (question.public_payload->'media'->>'width')::integer between 1 and 8192
          and (question.public_payload->'media'->>'height')::integer between 1 and 8192
        )
      )
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'number'
      and (solution->>'correctAnswer')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(solution->'tolerance') = 'number'
      and (solution->>'tolerance')::numeric >= 0;
  end if;
  if question.type = 'heat-map' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'targetLabel') = 'string'
      and char_length(btrim(question.public_payload->>'targetLabel')) between 1 and 500
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and question.public_payload->'surface'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'surface'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'surface'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'surface'->'height') = 'number'
      and (question.public_payload->'surface'->>'width')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'height')::integer between 1 and 8192
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'target') = 'object'
      and jsonb_typeof(solution->'target'->'x') = 'number'
      and (solution->'target'->>'x')::numeric between 0 and 1
      and jsonb_typeof(solution->'target'->'y') = 'number'
      and (solution->'target'->>'y')::numeric between 0 and 1
      and jsonb_typeof(solution->'fullCreditRadius') = 'number'
      and (solution->>'fullCreditRadius')::numeric >= 0
      and jsonb_typeof(solution->'toleranceRadius') = 'number'
      and (solution->>'toleranceRadius')::numeric > (solution->>'fullCreditRadius')::numeric;
  end if;
  if question.type = 'queens' and question.payload_schema_version = 1 then
    return private.queens_content_valid(question.public_payload, solution);
  end if;
  if question.type = 'word-search' and question.payload_schema_version = 1 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'grid') = 'object'
      and (question.public_payload->'grid'->>'rows')::integer between 6 and 10
      and (question.public_payload->'grid'->>'columns')::integer between 6 and 10
      and jsonb_typeof(question.public_payload->'letters') = 'array'
      and jsonb_array_length(question.public_payload->'letters') =
        (question.public_payload->'grid'->>'rows')::integer * (question.public_payload->'grid'->>'columns')::integer
      and jsonb_typeof(question.public_payload->'targets') = 'array'
      and jsonb_array_length(question.public_payload->'targets') between 2 and 8
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'positionsByTargetId') = 'object';
  end if;
  if question.type in (
    'true-false', 'ordering', 'classification', 'logic-matrix',
    'zip', 'escape', 'word-hashtag'
  ) then
    return private.is_supported_competitive_question_extension(target_question);
  end if;
  if question.payload_schema_version <> 1 then return false; end if;
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
  if question.type = 'short-text' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and (not question.public_payload ? 'answerPlaceholder'
        or jsonb_typeof(question.public_payload->'answerPlaceholder') in ('null', 'string'))
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
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
$$;

-- Shared editorial contracts: one question document and one challenge document.
create function private.validate_flash_question_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  option_count integer;
  expected_word_length integer;
  max_attempts integer;
  code_length integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
  grid_rows integer;
  grid_columns integer;
  target_id text;
  target_word text;
  target_pos jsonb;
  start_cell_i integer;
  end_cell_i integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  row_step_i integer;
  col_step_i integer;
  word_length_i integer;
  path_cell_i integer;
  path_offset_i integer;
  occurrence_count_i integer;
  candidate_word text;
  candidate_segment text;
  target_segment text;
  check_start integer;
  direction_row integer;
  direction_col integer;
  cell_row integer;
  cell_col integer;
  seen_ids text[] := array[]::text[];
  seen_words text[] := array[]::text[];
  seen_segments text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
  if document->>'type' = 'short-text' then
    if exists (select 1 from jsonb_object_keys(document) key_name where key_name <> all(array[
      'slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload'
    ]))
      or jsonb_typeof(document->'slug') is distinct from 'string'
      or char_length(btrim(document->>'slug')) not between 1 and 120
      or document->'payloadSchemaVersion' <> '1'::jsonb
      or jsonb_typeof(document->'timeLimitMs') is distinct from 'number'
      or (document->>'timeLimitMs')::numeric <> trunc((document->>'timeLimitMs')::numeric)
      or (document->>'timeLimitMs')::integer <= 0
      or jsonb_typeof(document->'publicPayload') is distinct from 'object'
      or not document->'publicPayload' ? 'question'
      or exists (select 1 from jsonb_object_keys(document->'publicPayload') key_name
        where key_name <> all(array['category', 'tags', 'question', 'answerPlaceholder']))
      or private.editorial_has_secret_key(document->'publicPayload')
      or jsonb_typeof(document->'publicPayload'->'question') is distinct from 'string'
      or char_length(btrim(document->'publicPayload'->>'question')) not between 1 and 2000
      or (document->'publicPayload' ? 'category' and jsonb_typeof(document->'publicPayload'->'category') is distinct from 'string')
      or (document->'publicPayload' ? 'tags' and jsonb_typeof(document->'publicPayload'->'tags') is distinct from 'object')
      or (document->'publicPayload' ? 'answerPlaceholder' and jsonb_typeof(document->'publicPayload'->'answerPlaceholder') not in ('null', 'string'))
      or jsonb_typeof(document->'solutionPayload') is distinct from 'object'
      or not document->'solutionPayload' ?& array['correctAnswer', 'acceptedAnswers']
      or exists (select 1 from jsonb_object_keys(document->'solutionPayload') key_name
        where key_name <> all(array['correctAnswer', 'acceptedAnswers', 'explanation']))
      or jsonb_typeof(document->'solutionPayload'->'correctAnswer') is distinct from 'string'
      or char_length(btrim(document->'solutionPayload'->>'correctAnswer')) not between 1 and 500
      or jsonb_typeof(document->'solutionPayload'->'acceptedAnswers') is distinct from 'array'
      or jsonb_array_length(document->'solutionPayload'->'acceptedAnswers') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(document->'solutionPayload'->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      or not exists (select 1 from jsonb_array_elements_text(document->'solutionPayload'->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(document->'solutionPayload'->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')) then
      raise exception 'invalid_question_document' using errcode = '22023';
    end if;
    return;
  end if;

  if not document ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  question := document;
  question_slug := btrim(question->>'slug');
  if jsonb_typeof(question->'slug') is distinct from 'string'
    or char_length(question_slug) not between 1 and 120
    or question->>'type' not in ('multiple-choice', 'estimation', 'heat-map', 'mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'connect-pairs', 'progressive-image', 'queens', 'true-false', 'odd-one-out', 'ordering', 'anagram', 'classification', 'short-text', 'word-search', 'word-hashtag', 'zip', 'escape')
    or (question->>'type' not in ('progressive-image', 'multiple-choice', 'estimation', 'heat-map') and question->'payloadSchemaVersion' <> '1'::jsonb)
    or (question->>'type' in ('progressive-image', 'multiple-choice') and question->'payloadSchemaVersion' not in ('1'::jsonb, '2'::jsonb))
    or (question->>'type' in ('estimation', 'heat-map') and question->'payloadSchemaVersion' <> '2'::jsonb)
    or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
    or (question->>'timeLimitMs')::numeric <= 0 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  public_payload := question->'publicPayload';
  solution_payload := question->'solutionPayload';
  seen_ids := array[]::text[];
  seen_words := array[]::text[];
  seen_segments := array[]::text[];

  if question->>'type' = 'estimation' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'min', 'max', 'step', 'initialValue', 'unit', 'media']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'min', 'max', 'step', 'initialValue', 'unit', 'media'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'min') is distinct from 'number'
      or jsonb_typeof(public_payload->'max') is distinct from 'number'
      or jsonb_typeof(public_payload->'step') is distinct from 'number'
      or jsonb_typeof(public_payload->'initialValue') is distinct from 'number'
      or (public_payload->>'min')::numeric >= (public_payload->>'max')::numeric
      or (public_payload->>'step')::numeric <= 0
      or (public_payload->>'initialValue')::numeric < (public_payload->>'min')::numeric
      or (public_payload->>'initialValue')::numeric > (public_payload->>'max')::numeric
      or abs(
        ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
        (public_payload->>'step')::numeric - round(
          ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
          (public_payload->>'step')::numeric
        )
      ) > 0.000000001
      or jsonb_typeof(public_payload->'unit') is distinct from 'string'
      or char_length(btrim(public_payload->>'unit')) not between 1 and 120
      or jsonb_typeof(public_payload->'media') not in ('null', 'object')
      or (jsonb_typeof(public_payload->'media') = 'object' and (
        not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
          'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'media'->>'type' <> 'image'
        or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
        or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
        or (public_payload->'media'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
        or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
        or (public_payload->'media'->>'height')::integer not between 1 and 8192
        or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'media' ? 'position' and (
          jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
          or char_length(public_payload->'media'->>'position') > 100
        ))
      )) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['correctAnswer', 'tolerance']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'tolerance', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'number'
      or (solution_payload->>'correctAnswer')::numeric < (public_payload->>'min')::numeric
      or (solution_payload->>'correctAnswer')::numeric > (public_payload->>'max')::numeric
      or jsonb_typeof(solution_payload->'tolerance') is distinct from 'number'
      or (solution_payload->>'tolerance')::numeric < 0
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'heat-map' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'surface', 'targetLabel']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'surface', 'targetLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'targetLabel') is distinct from 'string'
      or char_length(btrim(public_payload->>'targetLabel')) not between 1 and 500
      or jsonb_typeof(public_payload->'surface') is distinct from 'object'
      or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
        'assetId', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
      or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
      or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
      or (public_payload->'surface'->>'width')::integer not between 1 and 8192
      or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
      or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
      or (public_payload->'surface'->>'height')::integer not between 1 and 8192
      or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'surface' ? 'position' and (
        jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
        or char_length(public_payload->'surface'->>'position') > 100
      )) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['target', 'fullCreditRadius', 'toleranceRadius']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'target', 'fullCreditRadius', 'toleranceRadius', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'target') is distinct from 'object'
      or not solution_payload->'target' ?& array['x', 'y']
      or exists (select 1 from jsonb_object_keys(solution_payload->'target') key_name where key_name <> all(array['x', 'y']))
      or jsonb_typeof(solution_payload->'target'->'x') is distinct from 'number'
      or (solution_payload->'target'->>'x')::numeric not between 0 and 1
      or jsonb_typeof(solution_payload->'target'->'y') is distinct from 'number'
      or (solution_payload->'target'->>'y')::numeric not between 0 and 1
      or jsonb_typeof(solution_payload->'fullCreditRadius') is distinct from 'number'
      or (solution_payload->>'fullCreditRadius')::numeric < 0
      or jsonb_typeof(solution_payload->'toleranceRadius') is distinct from 'number'
      or (solution_payload->>'toleranceRadius')::numeric <= (solution_payload->>'fullCreditRadius')::numeric
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

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
    return;
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
    return;
  end if;

  if question->>'type' = 'logic-matrix' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'pieces', 'cells', 'optionIds']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'pieces', 'cells', 'optionIds', 'showPieceLabels'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'pieces') is distinct from 'array'
      or jsonb_array_length(public_payload->'pieces') not between 4 and 20
      or exists (
        select 1 from jsonb_array_elements(public_payload->'pieces') piece
        where jsonb_typeof(piece) is distinct from 'object'
          or not piece ?& array['id', 'symbol', 'label']
          or exists (select 1 from jsonb_object_keys(piece) key_name where key_name <> all(array['id', 'symbol', 'label']))
          or jsonb_typeof(piece->'id') is distinct from 'string'
          or char_length(btrim(piece->>'id')) not between 1 and 120
          or jsonb_typeof(piece->'symbol') is distinct from 'string'
          or char_length(btrim(piece->>'symbol')) not between 1 and 120
          or jsonb_typeof(piece->'label') is distinct from 'string'
          or char_length(btrim(piece->>'label')) not between 1 and 500
      )
      or (select count(*) from jsonb_array_elements(public_payload->'pieces') piece)
        <> (select count(distinct piece->>'id') from jsonb_array_elements(public_payload->'pieces') piece)
      or jsonb_typeof(public_payload->'cells') is distinct from 'array'
      or jsonb_array_length(public_payload->'cells') <> 9
      or (select count(*) from jsonb_array_elements(public_payload->'cells') cell where jsonb_typeof(cell) = 'null') <> 1
      or exists (
        select 1 from jsonb_array_elements(public_payload->'cells') cell
        where jsonb_typeof(cell) not in ('null', 'string')
          or (jsonb_typeof(cell) = 'string' and not exists (
            select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = cell #>> '{}'
          ))
      )
      or jsonb_typeof(public_payload->'optionIds') is distinct from 'array'
      or jsonb_array_length(public_payload->'optionIds') <> 4
      or exists (
        select 1 from jsonb_array_elements(public_payload->'optionIds') option_id
        where jsonb_typeof(option_id) is distinct from 'string'
          or not exists (
            select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = option_id #>> '{}'
          )
      )
      or (select count(*) from jsonb_array_elements_text(public_payload->'optionIds'))
        <> (select count(distinct value) from jsonb_array_elements_text(public_payload->'optionIds') value)
      or (public_payload ? 'showPieceLabels' and jsonb_typeof(public_payload->'showPieceLabels') not in ('null', 'boolean'))
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctOptionId'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['correctOptionId', 'explanation']))
      or jsonb_typeof(solution_payload->'correctOptionId') is distinct from 'string'
      or not exists (
        select 1 from jsonb_array_elements_text(public_payload->'optionIds') option_id
        where option_id = solution_payload->>'correctOptionId'
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
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
    return;
  end if;

  if question->>'type' = 'true-false' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ? 'question'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'boolean'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'odd-one-out' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 3 and 8
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'label']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'media']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
      )
      or exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(public_payload->'items') item
        group by item->>'id' having count(*) > 1
      ) duplicate_id) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or not exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where item->>'id' = solution_payload->>'correctAnswer'
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'connect-pairs' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'grid', 'pairs', 'requireFullCoverage']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'pairs', 'requireFullCoverage'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'grid') is distinct from 'object'
      or public_payload->'grid'->>'rows' <> '5'
      or public_payload->'grid'->>'columns' <> '5'
      or jsonb_typeof(public_payload->'pairs') is distinct from 'array'
      or jsonb_array_length(public_payload->'pairs') not between 3 and 5
      or public_payload->>'requireFullCoverage' <> 'true'
      or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
        where jsonb_typeof(pair) is distinct from 'object'
          or not pair ?& array['id', 'label', 'symbol', 'endpoints']
          or exists (select 1 from jsonb_object_keys(pair) key_name where key_name <> all(array['id', 'label', 'symbol', 'endpoints', 'color']))
          or jsonb_typeof(pair->'id') is distinct from 'string'
          or char_length(btrim(pair->>'id')) not between 1 and 120
          or jsonb_typeof(pair->'label') is distinct from 'string'
          or char_length(btrim(pair->>'label')) not between 1 and 500
          or jsonb_typeof(pair->'symbol') is distinct from 'string'
          or char_length(btrim(pair->>'symbol')) not between 1 and 32
          or jsonb_typeof(pair->'endpoints') is distinct from 'array'
          or jsonb_array_length(pair->'endpoints') <> 2
          or exists (select 1 from jsonb_array_elements(pair->'endpoints') endpoint
            where jsonb_typeof(endpoint) is distinct from 'number'
              or (endpoint #>> '{}')::numeric <> trunc((endpoint #>> '{}')::numeric)
              or (endpoint #>> '{}')::integer not between 0 and 24)
          or (pair ? 'color' and jsonb_typeof(pair->'color') is distinct from 'string'))
      or (select count(distinct pair->>'id') from jsonb_array_elements(public_payload->'pairs') pair)
         <> jsonb_array_length(public_payload->'pairs')
      or (select count(distinct endpoint #>> '{}') from jsonb_array_elements(public_payload->'pairs') pair, jsonb_array_elements(pair->'endpoints') endpoint)
         <> jsonb_array_length(public_payload->'pairs') * 2 then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'paths'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['paths', 'explanation']))
      or jsonb_typeof(solution_payload->'paths') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(solution_payload->'paths')) <> jsonb_array_length(public_payload->'pairs')
      or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
        where not solution_payload->'paths' ? (pair->>'id')
          or jsonb_typeof(solution_payload->'paths'->(pair->>'id')) is distinct from 'array')
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'ordering' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items', 'directionLabels'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 2 and 8
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'string'
          or char_length(btrim(item #>> '{}')) not between 1 and 500
      )
      or exists (select 1 from (
        select value from jsonb_array_elements_text(public_payload->'items') group by value having count(*) > 1
      ) duplicate_item)
      or (public_payload ? 'directionLabels' and jsonb_typeof(public_payload->'directionLabels') not in ('null', 'object'))
      or (jsonb_typeof(public_payload->'directionLabels') = 'object' and (
        exists (select 1 from jsonb_object_keys(public_payload->'directionLabels') key_name where key_name not in ('start', 'end'))
        or not (public_payload->'directionLabels' ?& array['start', 'end'])
        or jsonb_typeof(public_payload->'directionLabels'->'start') is distinct from 'string'
        or char_length(btrim(public_payload->'directionLabels'->>'start')) not between 1 and 120
        or jsonb_typeof(public_payload->'directionLabels'->'end') is distinct from 'string'
        or char_length(btrim(public_payload->'directionLabels'->>'end')) not between 1 and 120
      ))
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctOrder'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctOrder', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctOrder') is distinct from 'array'
      or jsonb_array_length(solution_payload->'correctOrder') <> jsonb_array_length(public_payload->'items')
      or exists (
        select 1 from jsonb_array_elements(solution_payload->'correctOrder') item
        where jsonb_typeof(item) is distinct from 'string'
      )
      or exists (
        select 1 from jsonb_array_elements_text(solution_payload->'correctOrder') item
        where not exists (select 1 from jsonb_array_elements_text(public_payload->'items') public_item where public_item = item)
      )
      or (select count(*) from jsonb_array_elements_text(solution_payload->'correctOrder')) <> (
        select count(distinct value) from jsonb_array_elements_text(solution_payload->'correctOrder') value
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'anagram' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'tiles']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'tiles', 'hint'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'tiles') is distinct from 'array'
      or jsonb_array_length(public_payload->'tiles') not between 3 and 10
      or exists (
        select 1 from jsonb_array_elements(public_payload->'tiles') tile
        where jsonb_typeof(tile) is distinct from 'object'
          or not tile ?& array['id', 'value']
          or exists (select 1 from jsonb_object_keys(tile) key_name where key_name <> all(array['id', 'value']))
          or jsonb_typeof(tile->'id') is distinct from 'string'
          or char_length(btrim(tile->>'id')) not between 1 and 120
          or jsonb_typeof(tile->'value') is distinct from 'string'
          or char_length(tile->>'value') <> 1
          or char_length(btrim(tile->>'value')) <> 1
      )
      or exists (select 1 from (
        select tile->>'id' as id from jsonb_array_elements(public_payload->'tiles') tile
        group by tile->>'id' having count(*) > 1
      ) duplicate_id)
      or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
      or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') = 'string' and char_length(public_payload->>'hint') > 500) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) not between 3 and 120
      or solution_payload->>'correctAnswer' ~ '\s'
      or char_length(solution_payload->>'correctAnswer') <> jsonb_array_length(public_payload->'tiles')
      or (select string_agg(lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
          from jsonb_array_elements(public_payload->'tiles') tile) <>
        (select string_agg(lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
          from regexp_split_to_table(solution_payload->>'correctAnswer', '') letter)
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'classification' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items', 'categories']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items', 'categories'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 2 and 20
      or jsonb_typeof(public_payload->'categories') is distinct from 'array'
      or jsonb_array_length(public_payload->'categories') not between 2 and 8
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ? 'label'
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> 'label')
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
      )
      or exists (select 1 from (
        select item->>'label' as label from jsonb_array_elements(public_payload->'items') item
        group by item->>'label' having count(*) > 1
      ) duplicate_label)
      or exists (
        select 1 from jsonb_array_elements(public_payload->'categories') category
        where jsonb_typeof(category) is distinct from 'string'
          or char_length(btrim(category #>> '{}')) not between 1 and 120
      )
      or exists (select 1 from (
        select value from jsonb_array_elements_text(public_payload->'categories') group by value having count(*) > 1
      ) duplicate_category) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'categoriesByItem'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'categoriesByItem', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'categoriesByItem') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(solution_payload->'categoriesByItem')) <> jsonb_array_length(public_payload->'items')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where not (solution_payload->'categoriesByItem' ? (item->>'label'))
          or jsonb_typeof(solution_payload->'categoriesByItem'->(item->>'label')) is distinct from 'string'
          or not exists (
            select 1 from jsonb_array_elements_text(public_payload->'categories') category
            where category = solution_payload->'categoriesByItem'->>(item->>'label')
          )
      )
      or exists (
        select 1 from jsonb_object_keys(solution_payload->'categoriesByItem') key_name
        where not exists (select 1 from jsonb_array_elements(public_payload->'items') item where item->>'label' = key_name)
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
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
    return;
  end if;

  if question->>'type' = 'word-search' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'grid', 'letters', 'targets']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'letters', 'targets'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or jsonb_typeof(public_payload->'grid') is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
      or not public_payload->'grid' ?& array['rows', 'columns']
      or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
      or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
      or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
      or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
      or (public_payload->'grid'->>'rows')::integer not between 6 and 10
      or (public_payload->'grid'->>'columns')::integer not between 6 and 10
      or jsonb_typeof(public_payload->'letters') is distinct from 'array'
      or jsonb_array_length(public_payload->'letters') <> (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer
      or exists (select 1 from jsonb_array_elements_text(public_payload->'letters') letter
        where char_length(upper(btrim(letter))) <> 1 or upper(btrim(letter)) !~ '^[A-ZÁÉÍÓÚÜÑ]$')
      or jsonb_typeof(public_payload->'targets') is distinct from 'array'
      or jsonb_array_length(public_payload->'targets') not between 2 and 8
      or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'word']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'word']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'word') is distinct from 'string'
          or char_length(btrim(item->>'word')) not between 1 and 120
          or upper(btrim(item->>'word')) !~ '^[A-ZÁÉÍÓÚÜÑ]+$')
      or exists (select 1 from (
        select btrim(item->>'id') value from jsonb_array_elements(public_payload->'targets') item
        group by btrim(item->>'id') having count(*) > 1
      ) duplicate)
      or exists (select 1 from (
        select upper(btrim(item->>'word')) value from jsonb_array_elements(public_payload->'targets') item
        group by upper(btrim(item->>'word')) having count(*) > 1
      ) duplicate) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'positionsByTargetId'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['positionsByTargetId', 'explanation']))
      or jsonb_typeof(solution_payload->'positionsByTargetId') is distinct from 'object'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or (select count(*) from jsonb_object_keys(solution_payload->'positionsByTargetId')) <> jsonb_array_length(public_payload->'targets')
      or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
        where not solution_payload->'positionsByTargetId' ? (item->>'id')) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;

    grid_rows := (public_payload->'grid'->>'rows')::integer;
    grid_columns := (public_payload->'grid'->>'columns')::integer;
    for target_id, target_word in
      select btrim(item->>'id'), upper(btrim(item->>'word'))
      from jsonb_array_elements(public_payload->'targets') item
    loop
      target_pos := solution_payload->'positionsByTargetId'->target_id;
      if jsonb_typeof(target_pos) is distinct from 'object'
        or not target_pos ?& array['startCell', 'endCell']
        or exists (select 1 from jsonb_object_keys(target_pos) key_name where key_name <> all(array['startCell', 'endCell']))
        or jsonb_typeof(target_pos->'startCell') is distinct from 'number'
        or jsonb_typeof(target_pos->'endCell') is distinct from 'number'
        or (target_pos->>'startCell')::numeric <> trunc((target_pos->>'startCell')::numeric)
        or (target_pos->>'endCell')::numeric <> trunc((target_pos->>'endCell')::numeric) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      start_cell_i := (target_pos->>'startCell')::integer;
      end_cell_i := (target_pos->>'endCell')::integer;
      start_row_i := floor(start_cell_i / grid_columns);
      start_col_i := start_cell_i % grid_columns;
      end_row_i := floor(end_cell_i / grid_columns);
      end_col_i := end_cell_i % grid_columns;
      if start_cell_i not between 0 and grid_rows * grid_columns - 1
        or end_cell_i not between 0 and grid_rows * grid_columns - 1
        or start_cell_i = end_cell_i
        or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      word_length_i := char_length(target_word);
      if array_length(seen_ids, 1) is not null and target_id = any(seen_ids)
        or array_length(seen_words, 1) is not null and target_word = any(seen_words) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      seen_ids := seen_ids || target_id;
      seen_words := seen_words || target_word;
      target_segment := least(start_cell_i, end_cell_i)::text || ':' || greatest(start_cell_i, end_cell_i)::text;
      if array_length(seen_segments, 1) is not null and target_segment = any(seen_segments) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      seen_segments := seen_segments || target_segment;
      row_step_i := sign(end_row_i - start_row_i);
      col_step_i := sign(end_col_i - start_col_i);
      candidate_word := '';
      for path_offset_i in 0..word_length_i - 1 loop
        path_cell_i := (start_row_i + row_step_i * path_offset_i) * grid_columns + start_col_i + col_step_i * path_offset_i;
        if path_cell_i < 0 or path_cell_i >= grid_rows * grid_columns then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
      end loop;
      if candidate_word <> target_word then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;

      occurrence_count_i := 0;
      for check_start in 0..grid_rows * grid_columns - 1 loop
        for direction_row in -1..1 loop
          for direction_col in -1..1 loop
            if direction_row = 0 and direction_col = 0 then continue; end if;
            candidate_word := '';
            candidate_segment := null;
            for path_offset_i in 0..word_length_i - 1 loop
              cell_row := floor(check_start / grid_columns) + direction_row * path_offset_i;
              cell_col := (check_start % grid_columns) + direction_col * path_offset_i;
              if cell_row < 0 or cell_row >= grid_rows or cell_col < 0 or cell_col >= grid_columns then
                candidate_word := null;
                exit;
              end if;
              path_cell_i := cell_row * grid_columns + cell_col;
              candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
            end loop;
            if candidate_word = target_word then
              candidate_segment := least(check_start, path_cell_i)::text || ':' || greatest(check_start, path_cell_i)::text;
              occurrence_count_i := occurrence_count_i + 1;
              if candidate_segment = target_segment then
                -- Both directions describe one undirected occurrence.
                occurrence_count_i := occurrence_count_i - 1;
              end if;
            end if;
          end loop;
        end loop;
      end loop;
      if occurrence_count_i <> 0 then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
    end loop;
    return;
  end if;

  if question->>'type' = 'word-hashtag' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.word_hashtag_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'zip' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'checkpoints', 'instruction', 'mapNote', 'boardLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
        or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
      or (public_payload ? 'mapNote' and (jsonb_typeof(public_payload->'mapNote') is distinct from 'string'
        or char_length(btrim(public_payload->>'mapNote')) not between 1 and 500))
      or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.zip_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'queens' then
    if exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name not in ('category', 'tags', 'question', 'grid', 'regions', 'prefilledQueens'))
      or private.editorial_has_secret_key(public_payload)
      or not private.queens_content_valid(public_payload, solution_payload)
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'escape' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'initialBlocks', 'instruction', 'hideInstruction',
        'objectiveLabel', 'hideObjectiveLabel', 'completionMessage', 'boardLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
        or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
      or (public_payload ? 'objectiveLabel' and (jsonb_typeof(public_payload->'objectiveLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'objectiveLabel')) not between 1 and 500))
      or (public_payload ? 'completionMessage' and (jsonb_typeof(public_payload->'completionMessage') is distinct from 'string'
        or char_length(btrim(public_payload->>'completionMessage')) not between 1 and 500))
      or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
      or (public_payload ? 'hideInstruction' and jsonb_typeof(public_payload->'hideInstruction') is distinct from 'boolean')
      or (public_payload ? 'hideObjectiveLabel' and jsonb_typeof(public_payload->'hideObjectiveLabel') is distinct from 'boolean')
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['referenceSolution', 'optimalMoves', 'explanation']))
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.escape_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'progressive-image' then
    if question->>'payloadSchemaVersion' = '2' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'revealDurationMs']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer not between 1 and 8192
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
    else
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
      or position(
        regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') in
        regexp_replace(lower(translate(btrim(public_payload->'surface'->>'alt'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
      ) > 0
      or jsonb_typeof(solution_payload->'solutionAlt') is distinct from 'string'
      or char_length(btrim(solution_payload->>'solutionAlt')) not between 1 and 500
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
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
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '1'
      and public_payload ? 'media' and public_payload->'media' ? 'assetId')
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '2' and (
      jsonb_typeof(public_payload->'media') is distinct from 'object'
      or not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
        'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or public_payload->'media'->>'type' <> 'image'
      or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
      or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
      or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
      or (public_payload->'media'->>'width')::integer not between 1 and 8192
      or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
      or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
      or (public_payload->'media'->>'height')::integer not between 1 and 8192
      or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'media' ? 'position' and (jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
        or char_length(public_payload->'media'->>'position') > 100))
    ))
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
  return;
end;
$$;

create function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  seen_question_versions text[] := array[]::text[];
  seen_level_ids text[] := array[]::text[];
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
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig', 'globalTimeLimitMs'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' not in ('flash', 'alphabet', 'survival', 'pyramid')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' = 'alphabet' and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' <> 'alphabet' and challenge ? 'globalTimeLimitMs')
    or (challenge->>'mode' = 'survival' and (
      (select count(*) from jsonb_object_keys(challenge->'modeConfig')) <> 1
      or jsonb_typeof(challenge->'modeConfig'->'lives') is distinct from 'number'
      or (challenge->'modeConfig'->>'lives')::numeric <> trunc((challenge->'modeConfig'->>'lives')::numeric)
      or (challenge->'modeConfig'->>'lives')::integer not between 1 and 20
    ))
    or (challenge->>'mode' = 'pyramid' and challenge->'modeConfig' <> '{}'::jsonb) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or (challenge->>'mode' = 'pyramid' and jsonb_array_length(document->'questions') <> 7)
    or (challenge->>'mode' <> 'pyramid' and jsonb_array_length(document->'questions') not between 2 and 20) then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  if challenge->>'mode' = 'survival'
    and (challenge->'modeConfig'->>'lives')::integer > jsonb_array_length(document->'questions') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if challenge->>'mode' = 'pyramid' then
      if not private.is_valid_pyramid_level_config(question->'modeConfig') then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      if question->'modeConfig'->>'levelId' = any(seen_level_ids) then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      seen_level_ids := seen_level_ids || (question->'modeConfig'->>'levelId');
    end if;
    if jsonb_typeof(question) = 'object' and question->>'source' = 'library' then
      if exists (
          select 1 from jsonb_object_keys(question) key_name
          where key_name <> all(array['source', 'questionVersionId', 'points', 'modeConfig', 'challengeItemId'])
        )
        or not question ?& array['source', 'questionVersionId', 'points', 'modeConfig']
        or jsonb_typeof(question->'questionVersionId') is distinct from 'string'
        or question->>'questionVersionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(question->'points') is distinct from 'number'
        or (question->>'points')::numeric <> trunc((question->>'points')::numeric)
        or (question->>'points')::integer <= 0
        or (question->>'points')::integer > 100
        or jsonb_typeof(question->'modeConfig') is distinct from 'object'
        or (question ? 'challengeItemId' and (
          jsonb_typeof(question->'challengeItemId') is distinct from 'string'
          or question->>'challengeItemId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or question->>'questionVersionId' = any(seen_question_versions) then
        raise exception 'invalid_question_reference' using errcode = '22023';
      end if;
      seen_question_versions := seen_question_versions || (question->>'questionVersionId');
      if challenge->>'mode' in ('survival', 'pyramid') and not exists (
        select 1 from private.question_versions supported
        where supported.id = (question->>'questionVersionId')::uuid
          and supported.type <> 'short-text'
          and private.is_supported_flash_question(supported.id)
      ) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig'])
      )
      or (challenge->>'mode' = 'pyramid' and not private.is_valid_pyramid_level_config(question->'modeConfig'))
      or (challenge->>'mode' <> 'pyramid' and question ? 'modeConfig') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    if challenge->>'mode' = 'survival' and question->>'type' = 'short-text' then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;

    perform private.validate_flash_question_document(question - 'points' - 'modeConfig');
    question_slug := btrim(question->>'slug');
    if question_slug = any(seen_slugs) then
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
  end loop;
  if challenge->>'mode' = 'alphabet' then
    if exists (
      select 1 from jsonb_array_elements(document->'questions') question_row
      where question_row->>'source' <> 'library'
        or jsonb_typeof(question_row->'modeConfig') is distinct from 'object'
        or jsonb_typeof(question_row->'modeConfig'->'letter') is distinct from 'string'
        or char_length(question_row->'modeConfig'->>'letter') = 0
        or char_length(question_row->'modeConfig'->>'letter') > 4
        or question_row->'modeConfig'->>'letter' !~ '^[[:alpha:]]$'
        or not exists (
          select 1 from private.question_versions version
          where version.id = (question_row->>'questionVersionId')::uuid
            and version.status = 'published' and version.type = 'short-text'
        )
    ) then
      raise exception 'invalid_alphabet_item' using errcode = '22023';
    end if;
    if exists (
      select 1 from (
        select lower(question_row->'modeConfig'->>'letter') as letter
        from jsonb_array_elements(document->'questions') question_row
      ) letters group by letter having count(*) > 1
    ) then
      raise exception 'duplicate_alphabet_letter' using errcode = '22023';
    end if;
  elsif exists (
    select 1
    from jsonb_array_elements(document->'questions') question_row
    where question_row->>'type' = 'short-text'
      or (question_row->>'source' = 'library' and exists (
        select 1 from private.question_versions version
        where version.id = (question_row->>'questionVersionId')::uuid
          and version.type = 'short-text'
      ))
  ) then
    raise exception 'short_text_requires_alphabet' using errcode = '22023';
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$$;

alter function private.validate_flash_question_document(jsonb) owner to postgres;
alter function private.validate_flash_editorial_document(jsonb) owner to postgres;
revoke all on function private.validate_flash_question_document(jsonb),
  private.validate_flash_editorial_document(jsonb)
  from public, anon, authenticated, service_role;
