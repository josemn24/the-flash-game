-- connect-pairs: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_connect_pairs_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'pairs', 'requireFullCoverage']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'grid', 'pairs', 'requireFullCoverage'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or public_payload->'grid'->>'rows' <> '5'
    or public_payload->'grid'->>'columns' <> '5'
    or jsonb_typeof(public_payload->'pairs') is distinct from 'array'
    or jsonb_array_length(public_payload->'pairs') not between 3 and 5
    or public_payload->>'requireFullCoverage' <> 'true'
    or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
      where jsonb_typeof(pair) is distinct from 'object'
        or not pair ?& array['id', 'label', 'symbol', 'endpoints']
        or exists (select 1 from jsonb_object_keys(pair) key_name where key_name <> all(array['id', 'label', 'symbol', 'endpoints', 'color']))
        or jsonb_typeof(pair->'id') is distinct from 'string'
        or char_length(btrim(pair->>'id')) not between 1 and 120
        or jsonb_typeof(pair->'label') is distinct from 'string'
        or char_length(btrim(pair->>'label')) not between 1 and 500
        or jsonb_typeof(pair->'symbol') is distinct from 'string'
        or char_length(btrim(pair->>'symbol')) not between 1 and 32
        or jsonb_typeof(pair->'endpoints') is distinct from 'array'
        or jsonb_array_length(pair->'endpoints') <> 2
        or exists (select 1 from jsonb_array_elements(pair->'endpoints') endpoint
          where jsonb_typeof(endpoint) is distinct from 'number'
            or (endpoint #>> '{}')::numeric <> trunc((endpoint #>> '{}')::numeric)
            or (endpoint #>> '{}')::integer not between 0 and 24)
        or (pair ? 'color' and jsonb_typeof(pair->'color') is distinct from 'string'))
    or (select count(distinct pair->>'id') from jsonb_array_elements(public_payload->'pairs') pair)
       <> jsonb_array_length(public_payload->'pairs')
    or (select count(distinct endpoint #>> '{}') from jsonb_array_elements(public_payload->'pairs') pair, jsonb_array_elements(pair->'endpoints') endpoint)
       <> jsonb_array_length(public_payload->'pairs') * 2 then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'paths'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['paths', 'explanation']))
    or jsonb_typeof(solution_payload->'paths') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(solution_payload->'paths')) <> jsonb_array_length(public_payload->'pairs')
    or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
      where not solution_payload->'paths' ? (pair->>'id')
        or jsonb_typeof(solution_payload->'paths'->(pair->>'id')) is distinct from 'array')
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_connect_pairs_question_document(jsonb) owner to postgres;
revoke all on function private.validate_connect_pairs_question_document(jsonb)
  from public, anon, authenticated, service_role;
