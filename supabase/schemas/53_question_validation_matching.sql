-- matching: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_matching_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'leftItems', 'rightItems']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'leftItems', 'rightItems'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'leftItems') is distinct from 'array'
    or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
    or jsonb_array_length(public_payload->'leftItems') not between 3 and 6
    or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or exists (
      select 1 from jsonb_array_elements(public_payload->'leftItems') item
      where jsonb_typeof(item) is distinct from 'object'
        or not item ?& array['id', 'label']
        or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
        or jsonb_typeof(item->'id') is distinct from 'string'
        or char_length(btrim(item->>'id')) not between 1 and 120
        or jsonb_typeof(item->'label') is distinct from 'string'
        or char_length(btrim(item->>'label')) not between 1 and 500
        or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
        or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
    )
    or exists (
      select 1 from jsonb_array_elements(public_payload->'rightItems') item
      where jsonb_typeof(item) is distinct from 'object'
        or not item ?& array['id', 'label']
        or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
        or jsonb_typeof(item->'id') is distinct from 'string'
        or char_length(btrim(item->>'id')) not between 1 and 120
        or jsonb_typeof(item->'label') is distinct from 'string'
        or char_length(btrim(item->>'label')) not between 1 and 500
        or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
        or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
    )
    or exists (select 1 from (
      select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item
      group by item->>'id' having count(*) > 1
    ) duplicate_id)
    or exists (select 1 from (
      select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item
      group by item->>'id' having count(*) > 1
    ) duplicate_id)
    or exists (select 1 from (
      select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
      from jsonb_array_elements(public_payload->'leftItems') item
      group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
    ) duplicate)
    or exists (select 1 from (
      select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
      from jsonb_array_elements(public_payload->'rightItems') item
      group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
    ) duplicate) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'matches'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches', 'explanation']))
    or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
    or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
    or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (
      select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value
    ))
    or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_matching_question_document(jsonb) owner to postgres;
revoke all on function private.validate_matching_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_matching_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  if question.payload_schema_version <> 1 then return false; end if;
  if question.type = 'matching' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'leftItems') = 'array'
      and jsonb_typeof(question.public_payload->'rightItems') = 'array'
      and jsonb_array_length(question.public_payload->'leftItems') between 3 and 6
      and jsonb_array_length(question.public_payload->'rightItems') = jsonb_array_length(question.public_payload->'leftItems')
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'leftItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'rightItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'leftItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'rightItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'matches') = 'object'
      and (select count(*) from jsonb_object_keys(solution->'matches')) = jsonb_array_length(question.public_payload->'leftItems')
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where not (solution->'matches' ? (item->>'id')))
      and not exists (select 1 from jsonb_each_text(solution->'matches') match
        where not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
          where item->>'id' = match.value))
      and (select count(*) from jsonb_each_text(solution->'matches')) =
        (select count(distinct value) from jsonb_each_text(solution->'matches'));
  end if;
  return false;
end;
$$;

alter function private.is_supported_matching_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_matching_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
