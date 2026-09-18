SET local check_function_bodies = off;

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
        or position(
          regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') in
          regexp_replace(lower(translate(btrim(public_payload->'surface'->>'alt'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        ) > 0
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
