-- progressive-clues: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_progressive_clues_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_progressive_clues_question_document(jsonb) owner to postgres;
revoke all on function private.validate_progressive_clues_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_progressive_clues_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.payload_schema_version <> 1 then return false; end if;
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
  return false;
end;
$$;

alter function private.is_supported_progressive_clues_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_progressive_clues_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
