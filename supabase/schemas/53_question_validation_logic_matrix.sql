-- logic-matrix: editorial validation. Published eligibility remains in the competitive extension.
-- Helpers declared later in the schema are resolved after the full load.
set local check_function_bodies = off;

create function private.validate_logic_matrix_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'pieces', 'cells', 'optionIds']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'pieces', 'cells', 'optionIds', 'showPieceLabels'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'pieces') is distinct from 'array'
    or jsonb_array_length(public_payload->'pieces') not between 4 and 20
    or exists (
      select 1 from jsonb_array_elements(public_payload->'pieces') piece
      where jsonb_typeof(piece) is distinct from 'object'
        or not piece ?& array['id', 'symbol', 'label']
        or exists (select 1 from jsonb_object_keys(piece) key_name where key_name <> all(array['id', 'symbol', 'label']))
        or jsonb_typeof(piece->'id') is distinct from 'string'
        or char_length(btrim(piece->>'id')) not between 1 and 120
        or jsonb_typeof(piece->'symbol') is distinct from 'string'
        or char_length(btrim(piece->>'symbol')) not between 1 and 120
        or jsonb_typeof(piece->'label') is distinct from 'string'
        or char_length(btrim(piece->>'label')) not between 1 and 500
    )
    or (select count(*) from jsonb_array_elements(public_payload->'pieces') piece)
      <> (select count(distinct piece->>'id') from jsonb_array_elements(public_payload->'pieces') piece)
    or jsonb_typeof(public_payload->'cells') is distinct from 'array'
    or jsonb_array_length(public_payload->'cells') <> 9
    or (select count(*) from jsonb_array_elements(public_payload->'cells') cell where jsonb_typeof(cell) = 'null') <> 1
    or exists (
      select 1 from jsonb_array_elements(public_payload->'cells') cell
      where jsonb_typeof(cell) not in ('null', 'string')
        or (jsonb_typeof(cell) = 'string' and not exists (
          select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = cell #>> '{}'
        ))
    )
    or jsonb_typeof(public_payload->'optionIds') is distinct from 'array'
    or jsonb_array_length(public_payload->'optionIds') <> 4
    or exists (
      select 1 from jsonb_array_elements(public_payload->'optionIds') option_id
      where jsonb_typeof(option_id) is distinct from 'string'
        or not exists (
          select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = option_id #>> '{}'
        )
    )
    or (select count(*) from jsonb_array_elements_text(public_payload->'optionIds'))
      <> (select count(distinct value) from jsonb_array_elements_text(public_payload->'optionIds') value)
    or (public_payload ? 'showPieceLabels' and jsonb_typeof(public_payload->'showPieceLabels') not in ('null', 'boolean'))
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctOptionId'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['correctOptionId', 'explanation']))
    or jsonb_typeof(solution_payload->'correctOptionId') is distinct from 'string'
    or not exists (
      select 1 from jsonb_array_elements_text(public_payload->'optionIds') option_id
      where option_id = solution_payload->>'correctOptionId'
    )
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_logic_matrix_question_document(jsonb) owner to postgres;
revoke all on function private.validate_logic_matrix_question_document(jsonb)
  from public, anon, authenticated, service_role;
