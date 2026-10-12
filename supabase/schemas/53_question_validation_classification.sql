-- classification: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_classification_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'items', 'categories']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'items', 'categories'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'items') is distinct from 'array'
    or jsonb_array_length(public_payload->'items') not between 2 and 20
    or jsonb_typeof(public_payload->'categories') is distinct from 'array'
    or jsonb_array_length(public_payload->'categories') not between 2 and 8
    or exists (
      select 1 from jsonb_array_elements(public_payload->'items') item
      where jsonb_typeof(item) is distinct from 'object'
        or not item ? 'label'
        or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> 'label')
        or jsonb_typeof(item->'label') is distinct from 'string'
        or char_length(btrim(item->>'label')) not between 1 and 500
    )
    or exists (select 1 from (
      select item->>'label' as label from jsonb_array_elements(public_payload->'items') item
      group by item->>'label' having count(*) > 1
    ) duplicate_label)
    or exists (
      select 1 from jsonb_array_elements(public_payload->'categories') category
      where jsonb_typeof(category) is distinct from 'string'
        or char_length(btrim(category #>> '{}')) not between 1 and 120
    )
    or exists (select 1 from (
      select value from jsonb_array_elements_text(public_payload->'categories') group by value having count(*) > 1
    ) duplicate_category) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'categoriesByItem'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
      'categoriesByItem', 'explanation'
    ]))
    or jsonb_typeof(solution_payload->'categoriesByItem') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(solution_payload->'categoriesByItem')) <> jsonb_array_length(public_payload->'items')
    or exists (
      select 1 from jsonb_array_elements(public_payload->'items') item
      where not (solution_payload->'categoriesByItem' ? (item->>'label'))
        or jsonb_typeof(solution_payload->'categoriesByItem'->(item->>'label')) is distinct from 'string'
        or not exists (
          select 1 from jsonb_array_elements_text(public_payload->'categories') category
          where category = solution_payload->'categoriesByItem'->>(item->>'label')
        )
    )
    or exists (
      select 1 from jsonb_object_keys(solution_payload->'categoriesByItem') key_name
      where not exists (select 1 from jsonb_array_elements(public_payload->'items') item where item->>'label' = key_name)
    )
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_classification_question_document(jsonb) owner to postgres;
revoke all on function private.validate_classification_question_document(jsonb)
  from public, anon, authenticated, service_role;
