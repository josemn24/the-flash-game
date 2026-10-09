-- ordering: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_ordering_question_document(document jsonb) returns void
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
      'category', 'tags', 'question', 'items', 'directionLabels'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'items') is distinct from 'array'
    or jsonb_array_length(public_payload->'items') not between 2 and 8
    or exists (
      select 1 from jsonb_array_elements(public_payload->'items') item
      where jsonb_typeof(item) is distinct from 'string'
        or char_length(btrim(item #>> '{}')) not between 1 and 500
    )
    or exists (select 1 from (
      select value from jsonb_array_elements_text(public_payload->'items') group by value having count(*) > 1
    ) duplicate_item)
    or (public_payload ? 'directionLabels' and jsonb_typeof(public_payload->'directionLabels') not in ('null', 'object'))
    or (jsonb_typeof(public_payload->'directionLabels') = 'object' and (
      exists (select 1 from jsonb_object_keys(public_payload->'directionLabels') key_name where key_name not in ('start', 'end'))
      or not (public_payload->'directionLabels' ?& array['start', 'end'])
      or jsonb_typeof(public_payload->'directionLabels'->'start') is distinct from 'string'
      or char_length(btrim(public_payload->'directionLabels'->>'start')) not between 1 and 120
      or jsonb_typeof(public_payload->'directionLabels'->'end') is distinct from 'string'
      or char_length(btrim(public_payload->'directionLabels'->>'end')) not between 1 and 120
    ))
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctOrder'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
      'correctOrder', 'explanation'
    ]))
    or jsonb_typeof(solution_payload->'correctOrder') is distinct from 'array'
    or jsonb_array_length(solution_payload->'correctOrder') <> jsonb_array_length(public_payload->'items')
    or exists (
      select 1 from jsonb_array_elements(solution_payload->'correctOrder') item
      where jsonb_typeof(item) is distinct from 'string'
    )
    or exists (
      select 1 from jsonb_array_elements_text(solution_payload->'correctOrder') item
      where not exists (select 1 from jsonb_array_elements_text(public_payload->'items') public_item where public_item = item)
    )
    or (select count(*) from jsonb_array_elements_text(solution_payload->'correctOrder')) <> (
      select count(distinct value) from jsonb_array_elements_text(solution_payload->'correctOrder') value
    )
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_ordering_question_document(jsonb) owner to postgres;
revoke all on function private.validate_ordering_question_document(jsonb)
  from public, anon, authenticated, service_role;
