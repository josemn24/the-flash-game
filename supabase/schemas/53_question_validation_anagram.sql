-- anagram: editorial validation and published eligibility are distinct contracts.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_anagram_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'tiles']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'tiles', 'hint'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'tiles') is distinct from 'array'
    or jsonb_array_length(public_payload->'tiles') not between 3 and 10
    or exists (
      select 1 from jsonb_array_elements(public_payload->'tiles') tile
      where jsonb_typeof(tile) is distinct from 'object'
        or not tile ?& array['id', 'value']
        or exists (select 1 from jsonb_object_keys(tile) key_name where key_name <> all(array['id', 'value']))
        or jsonb_typeof(tile->'id') is distinct from 'string'
        or char_length(btrim(tile->>'id')) not between 1 and 120
        or jsonb_typeof(tile->'value') is distinct from 'string'
        or char_length(tile->>'value') <> 1
        or char_length(btrim(tile->>'value')) <> 1
    )
    or exists (select 1 from (
      select tile->>'id' as id from jsonb_array_elements(public_payload->'tiles') tile
      group by tile->>'id' having count(*) > 1
    ) duplicate_id)
    or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
    or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') = 'string' and char_length(public_payload->>'hint') > 500) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctAnswer'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
      'correctAnswer', 'explanation'
    ]))
    or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
    or char_length(btrim(solution_payload->>'correctAnswer')) not between 3 and 120
    or solution_payload->>'correctAnswer' ~ '\s'
    or char_length(solution_payload->>'correctAnswer') <> jsonb_array_length(public_payload->'tiles')
    or (select string_agg(lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
        from jsonb_array_elements(public_payload->'tiles') tile) <>
      (select string_agg(lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
        from regexp_split_to_table(solution_payload->>'correctAnswer', '') letter)
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_anagram_question_document(jsonb) owner to postgres;
revoke all on function private.validate_anagram_question_document(jsonb)
  from public, anon, authenticated, service_role;

create function private.is_supported_anagram_question(question private.question_versions, solution jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare
  target_question uuid := question.id;
begin
  if question.type = 'anagram' and question.payload_schema_version = 1 then
    perform private.validate_flash_question_document(private.question_version_document(target_question));
    return true;
  end if;
  return false;
end;
$$;

alter function private.is_supported_anagram_question(private.question_versions, jsonb) owner to postgres;
revoke all on function private.is_supported_anagram_question(private.question_versions, jsonb)
  from public, anon, authenticated, service_role;
