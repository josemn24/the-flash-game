-- E03: extend the already deployed editorial/publication validators without
-- rewriting the E01/E02 validator bodies in the migration history.

set local check_function_bodies = off;

alter function private.validate_flash_editorial_document(jsonb)
  rename to validate_flash_editorial_document_base;

create function private.validate_flash_editorial_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare
  question jsonb;
  sanitized_question jsonb;
  sanitized_questions jsonb := '[]'::jsonb;
  sanitized_document jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  question_index integer;
  normalized_correct text;
begin
  if jsonb_typeof(document) is distinct from 'object'
    or jsonb_typeof(document->'questions') is distinct from 'array'
    or not exists (
      select 1 from jsonb_array_elements(document->'questions') value
      where value->>'type' = 'progressive-clues'
    ) then
    perform private.validate_flash_editorial_document_base(document);
    return;
  end if;

  -- Let the deployed validator continue to enforce the common Flash contract
  -- and all non-E03 question formats. Progressive questions are replaced by a
  -- harmless valid MC placeholder only for that common validation pass.
  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if question->>'type' = 'progressive-clues' then
      sanitized_question := jsonb_set(question, '{type}', '"multiple-choice"'::jsonb);
      sanitized_question := jsonb_set(
        sanitized_question, '{publicPayload}', '{"question":"E03","options":["E03","E03-2"]}'::jsonb);
      sanitized_question := jsonb_set(
        sanitized_question, '{solutionPayload}', '{"correctAnswer":"E03"}'::jsonb);
    else
      sanitized_question := question;
    end if;
    sanitized_questions := sanitized_questions || jsonb_build_array(sanitized_question);
  end loop;
  sanitized_document := jsonb_set(document, '{questions}', sanitized_questions);
  perform private.validate_flash_editorial_document_base(sanitized_document);

  for question in select value from jsonb_array_elements(document->'questions') loop
    if question->>'type' <> 'progressive-clues' then continue; end if;
    public_payload := question->'publicPayload';
    solution_payload := question->'solutionPayload';
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
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;

    normalized_correct := regexp_replace(
      lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')),
      '\s+', '', 'g');
    if exists (
      select 1
      from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
      group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
      having count(*) > 1
    ) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
      where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') = normalized_correct
    ) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
  end loop;
end;
$$;

alter function private.validate_flash_editorial_document(jsonb) owner to postgres;
alter function private.validate_flash_editorial_document_base(jsonb) owner to postgres;
revoke all on function private.validate_flash_editorial_document(jsonb),
  private.validate_flash_editorial_document_base(jsonb)
  from public, anon, authenticated, service_role;

alter function private.is_supported_flash_question(uuid)
  rename to is_supported_flash_question_base;

create function private.is_supported_flash_question(target_question uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  question private.question_versions%rowtype;
  solution jsonb;
  normalized_correct text;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.type <> 'progressive-clues' then
    return private.is_supported_flash_question_base(target_question);
  end if;
  select solution_payload into solution
  from private.question_version_solutions
  where question_version_id = question.id;
  if question.status <> 'published' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload) is distinct from 'object'
    or jsonb_typeof(question.public_payload->'question') is distinct from 'string'
    or char_length(btrim(question.public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(question.public_payload->'clues') is distinct from 'array'
    or jsonb_array_length(question.public_payload->'clues') not between 1 and 20
    or jsonb_typeof(question.public_payload->'cluePenalty') is distinct from 'number'
    or (question.public_payload->>'cluePenalty')::numeric <> trunc((question.public_payload->>'cluePenalty')::numeric)
    or (question.public_payload->>'cluePenalty')::integer not between 0 and 50
    or private.editorial_has_secret_key(question.public_payload)
    or exists (select 1 from jsonb_array_elements(question.public_payload->'clues') clue
      where jsonb_typeof(clue) is distinct from 'string'
        or char_length(btrim(clue #>> '{}')) not between 1 and 500)
    or jsonb_typeof(solution) is distinct from 'object'
    or jsonb_typeof(solution->'correctAnswer') is distinct from 'string'
    or char_length(btrim(solution->>'correctAnswer')) not between 1 and 500
    or jsonb_typeof(solution->'acceptedAnswers') is distinct from 'array'
    or jsonb_array_length(solution->'acceptedAnswers') not between 1 and 100
    or exists (select 1 from jsonb_array_elements(solution->'acceptedAnswers') answer
      where jsonb_typeof(answer) is distinct from 'string'
        or char_length(btrim(answer #>> '{}')) not between 1 and 500) then
    return false;
  end if;
  normalized_correct := regexp_replace(
    lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')),
    '\s+', '', 'g');
  return not exists (
    select 1
    from jsonb_array_elements_text(solution->'acceptedAnswers') answer
    group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
    having count(*) > 1
  ) and exists (
    select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
    where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') = normalized_correct
  );
end;
$$;

alter function private.is_supported_flash_question(uuid) owner to postgres;
alter function private.is_supported_flash_question_base(uuid) owner to postgres;
revoke all on function private.is_supported_flash_question(uuid), private.is_supported_flash_question_base(uuid)
  from public, anon, authenticated, service_role;
