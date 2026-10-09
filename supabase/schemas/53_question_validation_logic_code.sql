-- logic-code: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_logic_code_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_logic_code_question_document(jsonb) owner to postgres;
revoke all on function private.validate_logic_code_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_logic_code_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.payload_schema_version <> 1 then return false; end if;
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
  return false;
end;
$$;

alter function private.is_supported_logic_code_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_logic_code_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
