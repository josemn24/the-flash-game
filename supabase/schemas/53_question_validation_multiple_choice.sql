-- multiple-choice: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_multiple_choice_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  option_count integer;
begin
  question := document;
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'options']
    or exists (
      select 1 from jsonb_object_keys(public_payload) key_name
      where key_name <> all(array['category', 'tags', 'question', 'options', 'media', 'promptVisual'])
    )
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'options') is distinct from 'array'
    or jsonb_array_length(public_payload->'options') < 2
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or (public_payload ? 'media' and jsonb_typeof(public_payload->'media') not in ('null', 'object'))
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '1'
      and public_payload ? 'media' and public_payload->'media' ? 'assetId')
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '2' and (
      jsonb_typeof(public_payload->'media') is distinct from 'object'
      or not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
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
      or (public_payload->'media' ? 'position' and (jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
        or char_length(public_payload->'media'->>'position') > 100))
    ))
    or (public_payload ? 'promptVisual' and jsonb_typeof(public_payload->'promptVisual') not in ('null', 'object')) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;

  for option in select value from jsonb_array_elements(public_payload->'options') loop
    if jsonb_typeof(option) is distinct from 'string' or char_length(btrim(option #>> '{}')) = 0 then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
  end loop;
  select count(distinct value) into option_count from jsonb_array_elements_text(public_payload->'options');
  if option_count <> jsonb_array_length(public_payload->'options') then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctAnswer'
    or exists (
      select 1 from jsonb_object_keys(solution_payload) key_name
      where key_name <> all(array['correctAnswer', 'explanation'])
    )
    or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
    or char_length(btrim(solution_payload->>'correctAnswer')) = 0
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_array_elements_text(public_payload->'options') value
    where value = solution_payload->>'correctAnswer'
  ) then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_multiple_choice_question_document(jsonb) owner to postgres;
revoke all on function private.validate_multiple_choice_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_multiple_choice_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.type = 'multiple-choice' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and jsonb_typeof(question.public_payload->'media') = 'object'
      and question.public_payload->'media'->>'type' = 'image'
      and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
      and (question.public_payload->'media'->>'width')::integer between 1 and 8192
      and (question.public_payload->'media'->>'height')::integer between 1 and 8192
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  if question.payload_schema_version <> 1 then return false; end if;
  if question.type = 'multiple-choice' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  return false;
end;
$$;

alter function private.is_supported_multiple_choice_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_multiple_choice_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
