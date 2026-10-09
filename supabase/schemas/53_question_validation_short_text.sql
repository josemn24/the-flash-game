-- short-text: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_short_text_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
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
end;
$$;

alter function private.validate_short_text_question_document(jsonb) owner to postgres;
revoke all on function private.validate_short_text_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_short_text_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.payload_schema_version <> 1 then return false; end if;
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
  return false;
end;
$$;

alter function private.is_supported_short_text_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_short_text_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
