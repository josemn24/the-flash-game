-- queens: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_queens_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name not in ('category', 'tags', 'question', 'grid', 'regions', 'prefilledQueens'))
    or private.editorial_has_secret_key(public_payload)
    or not private.queens_content_valid(public_payload, solution_payload)
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_queens_question_document(jsonb) owner to postgres;
revoke all on function private.validate_queens_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_queens_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.type = 'queens' and question.payload_schema_version = 1 then
    return private.queens_content_valid(question.public_payload, solution);
  end if;
  return false;
end;
$$;

alter function private.is_supported_queens_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_queens_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
