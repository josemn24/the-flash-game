-- heat-map: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_heat_map_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
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
end;
$$;

alter function private.validate_heat_map_question_document(jsonb) owner to postgres;
revoke all on function private.validate_heat_map_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_heat_map_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
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
  if question.type = 'heat-map' and question.payload_schema_version = 1 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(question.public_payload->'targetLabel') = 'string'
      and char_length(btrim(question.public_payload->>'targetLabel')) between 1 and 500
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and jsonb_typeof(question.public_payload->'surface'->'src') = 'string'
      and char_length(btrim(question.public_payload->'surface'->>'src')) > 0
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and (question.public_payload->'surface'->>'width')::numeric = trunc((question.public_payload->'surface'->>'width')::numeric)
      and (question.public_payload->'surface'->>'width')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'height')::numeric = trunc((question.public_payload->'surface'->>'height')::numeric)
      and (question.public_payload->'surface'->>'height')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'fit' is null or question.public_payload->'surface'->>'fit' in ('cover','contain'))
      and (not question.public_payload->'surface' ? 'position' or jsonb_typeof(question.public_payload->'surface'->'position') = 'string')
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'target'->'x') = 'number'
      and (solution->'target'->>'x')::numeric between 0 and 1
      and jsonb_typeof(solution->'target'->'y') = 'number'
      and (solution->'target'->>'y')::numeric between 0 and 1
      and jsonb_typeof(solution->'fullCreditRadius') = 'number'
      and (solution->>'fullCreditRadius')::numeric >= 0
      and jsonb_typeof(solution->'toleranceRadius') = 'number'
      and (solution->>'toleranceRadius')::numeric > (solution->>'fullCreditRadius')::numeric;
  end if;
  return false;
end;
$$;

alter function private.is_supported_heat_map_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_heat_map_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
