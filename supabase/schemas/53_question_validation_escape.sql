-- escape: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_escape_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_escape_question_document(jsonb) owner to postgres;
revoke all on function private.validate_escape_question_document(jsonb)
  from public, anon, authenticated, service_role;
