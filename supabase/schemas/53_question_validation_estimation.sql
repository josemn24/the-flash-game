-- estimation: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_estimation_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'min', 'max', 'step', 'initialValue', 'unit', 'media']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'min', 'max', 'step', 'initialValue', 'unit', 'media'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'min') is distinct from 'number'
    or jsonb_typeof(public_payload->'max') is distinct from 'number'
    or jsonb_typeof(public_payload->'step') is distinct from 'number'
    or jsonb_typeof(public_payload->'initialValue') is distinct from 'number'
    or (public_payload->>'min')::numeric >= (public_payload->>'max')::numeric
    or (public_payload->>'step')::numeric <= 0
    or (public_payload->>'initialValue')::numeric < (public_payload->>'min')::numeric
    or (public_payload->>'initialValue')::numeric > (public_payload->>'max')::numeric
    or abs(
      ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
      (public_payload->>'step')::numeric - round(
        ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
        (public_payload->>'step')::numeric
      )
    ) > 0.000000001
    or jsonb_typeof(public_payload->'unit') is distinct from 'string'
    or char_length(btrim(public_payload->>'unit')) not between 1 and 120
    or jsonb_typeof(public_payload->'media') not in ('null', 'object')
    or (jsonb_typeof(public_payload->'media') = 'object' and (
      not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
        'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or public_payload->'media'->>'type' <> 'image'
      or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
      or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
      or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
      or (public_payload->'media'->>'width')::integer not between 1 and 8192
      or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
      or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
      or (public_payload->'media'->>'height')::integer not between 1 and 8192
      or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'media' ? 'position' and (
        jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
        or char_length(public_payload->'media'->>'position') > 100
      ))
    )) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ?& array['correctAnswer', 'tolerance']
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
      'correctAnswer', 'tolerance', 'explanation'
    ]))
    or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'number'
    or (solution_payload->>'correctAnswer')::numeric < (public_payload->>'min')::numeric
    or (solution_payload->>'correctAnswer')::numeric > (public_payload->>'max')::numeric
    or jsonb_typeof(solution_payload->'tolerance') is distinct from 'number'
    or (solution_payload->>'tolerance')::numeric < 0
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_estimation_question_document(jsonb) owner to postgres;
revoke all on function private.validate_estimation_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_estimation_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.type = 'estimation' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'min') = 'number'
      and jsonb_typeof(question.public_payload->'max') = 'number'
      and jsonb_typeof(question.public_payload->'step') = 'number'
      and jsonb_typeof(question.public_payload->'initialValue') = 'number'
      and (question.public_payload->>'min')::numeric < (question.public_payload->>'max')::numeric
      and (question.public_payload->>'step')::numeric > 0
      and (question.public_payload->>'initialValue')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(question.public_payload->'unit') = 'string'
      and char_length(btrim(question.public_payload->>'unit')) between 1 and 120
      and jsonb_typeof(question.public_payload->'media') in ('null', 'object')
      and (
        jsonb_typeof(question.public_payload->'media') = 'null'
        or (
          question.public_payload->'media'->>'type' = 'image'
          and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
          and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
          and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
          and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
          and (question.public_payload->'media'->>'width')::integer between 1 and 8192
          and (question.public_payload->'media'->>'height')::integer between 1 and 8192
        )
      )
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'number'
      and (solution->>'correctAnswer')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(solution->'tolerance') = 'number'
      and (solution->>'tolerance')::numeric >= 0;
  end if;
  if question.type = 'estimation' and question.payload_schema_version = 1 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(question.public_payload->'min') = 'number'
      and jsonb_typeof(question.public_payload->'max') = 'number'
      and (question.public_payload->>'min')::numeric < (question.public_payload->>'max')::numeric
      and jsonb_typeof(question.public_payload->'step') = 'number'
      and (question.public_payload->>'step')::numeric > 0
      and jsonb_typeof(question.public_payload->'initialValue') = 'number'
      and (question.public_payload->>'initialValue')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(question.public_payload->'unit') = 'string'
      and char_length(btrim(question.public_payload->>'unit')) between 1 and 100
      and (not question.public_payload ? 'media' or question.public_payload->'media' = 'null'::jsonb
        or (jsonb_typeof(question.public_payload->'media') = 'object'
          and question.public_payload->'media'->>'type' = 'image'
          and jsonb_typeof(question.public_payload->'media'->'src') = 'string'
          and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'))
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'number'
      and (solution->>'correctAnswer')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(solution->'tolerance') = 'number'
      and (solution->>'tolerance')::numeric >= 0;
  end if;
  return false;
end;
$$;

alter function private.is_supported_estimation_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_estimation_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
