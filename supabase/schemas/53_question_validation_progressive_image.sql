-- progressive-image: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_progressive_image_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
begin
  question := document;
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_progressive_image_question_document(jsonb) owner to postgres;
revoke all on function private.validate_progressive_image_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_progressive_image_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
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
  if question.payload_schema_version <> 1 then return false; end if;
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
  return false;
end;
$$;

alter function private.is_supported_progressive_image_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_progressive_image_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
