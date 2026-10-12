-- odd-one-out: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_odd_one_out_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'items']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'items'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'items') is distinct from 'array'
    or jsonb_array_length(public_payload->'items') not between 3 and 8
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or exists (
      select 1 from jsonb_array_elements(public_payload->'items') item
      where jsonb_typeof(item) is distinct from 'object'
        or not item ?& array['id', 'label']
        or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'media']))
        or jsonb_typeof(item->'id') is distinct from 'string'
        or char_length(btrim(item->>'id')) not between 1 and 120
        or jsonb_typeof(item->'label') is distinct from 'string'
        or char_length(btrim(item->>'label')) not between 1 and 500
        or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
    )
    or exists (select 1 from (
      select item->>'id' as id from jsonb_array_elements(public_payload->'items') item
      group by item->>'id' having count(*) > 1
    ) duplicate_id) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctAnswer'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
      'correctAnswer', 'explanation'
    ]))
    or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
    or not exists (
      select 1 from jsonb_array_elements(public_payload->'items') item
      where item->>'id' = solution_payload->>'correctAnswer'
    )
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_odd_one_out_question_document(jsonb) owner to postgres;
revoke all on function private.validate_odd_one_out_question_document(jsonb)
  from public, anon, authenticated, service_role;
