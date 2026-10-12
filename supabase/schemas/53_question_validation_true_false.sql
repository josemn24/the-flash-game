-- true-false: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_true_false_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_true_false_question_document(jsonb) owner to postgres;
revoke all on function private.validate_true_false_question_document(jsonb)
  from public, anon, authenticated, service_role;
