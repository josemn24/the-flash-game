-- Expand Connect Pairs validation to square boards from 4x4 through 8x8.
-- The existing public payload shape and v1 schema version remain unchanged.
set local check_function_bodies = off;

create or replace function private.validate_connect_pairs_question_document(document jsonb) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  public_payload jsonb;
  solution_payload jsonb;
  pair jsonb;
  endpoint jsonb;
  board_rows integer;
  cell_count integer;
begin
  public_payload := document->'publicPayload';
  solution_payload := document->'solutionPayload';
  if jsonb_typeof(public_payload) is distinct from 'object' then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if not public_payload ?& array['question', 'grid', 'pairs', 'requireFullCoverage']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
      'category', 'tags', 'question', 'grid', 'pairs', 'requireFullCoverage'
    ]))
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or public_payload->>'requireFullCoverage' <> 'true' then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or public_payload->'grid'->>'rows' !~ '^[4-8]([.]0+)?$'
    or public_payload->'grid'->>'columns' !~ '^[4-8]([.]0+)?$'
    or (public_payload->'grid'->>'columns')::numeric <> (public_payload->'grid'->>'rows')::numeric then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;

  board_rows := (public_payload->'grid'->>'rows')::integer;
  cell_count := board_rows * board_rows;
  if jsonb_typeof(public_payload->'pairs') is distinct from 'array' then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_array_length(public_payload->'pairs') not between 3 and board_rows then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  for pair in select value from jsonb_array_elements(public_payload->'pairs') loop
    if jsonb_typeof(pair) is distinct from 'object' then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if not pair ?& array['id', 'label', 'symbol', 'endpoints']
      or exists (select 1 from jsonb_object_keys(pair) key_name where key_name <> all(array['id', 'label', 'symbol', 'endpoints', 'color']))
      or jsonb_typeof(pair->'id') is distinct from 'string'
      or char_length(btrim(pair->>'id')) not between 1 and 120
      or jsonb_typeof(pair->'label') is distinct from 'string'
      or char_length(btrim(pair->>'label')) not between 1 and 500
      or jsonb_typeof(pair->'symbol') is distinct from 'string'
      or char_length(btrim(pair->>'symbol')) not between 1 and 32
      or (pair ? 'color' and jsonb_typeof(pair->'color') is distinct from 'string') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(pair->'endpoints') is distinct from 'array' then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_array_length(pair->'endpoints') <> 2 then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    for endpoint in select value from jsonb_array_elements(pair->'endpoints') loop
      if jsonb_typeof(endpoint) is distinct from 'number' then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if (endpoint #>> '{}')::numeric <> trunc((endpoint #>> '{}')::numeric)
        or (endpoint #>> '{}')::numeric not between 0 and cell_count - 1 then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
    end loop;
  end loop;
  if (select count(distinct pair_item->>'id') from jsonb_array_elements(public_payload->'pairs') as pairs(pair_item))
       <> jsonb_array_length(public_payload->'pairs')
    or (select count(distinct endpoint_item #>> '{}')
      from jsonb_array_elements(public_payload->'pairs') as pairs(pair_item),
        jsonb_array_elements(pair_item->'endpoints') as endpoints(endpoint_item))
       <> jsonb_array_length(public_payload->'pairs') * 2 then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload) is distinct from 'object' then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  if not solution_payload ? 'paths'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['paths', 'explanation']))
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  if jsonb_typeof(solution_payload->'paths') is distinct from 'object' then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(solution_payload->'paths')) <> jsonb_array_length(public_payload->'pairs')
    or exists (select 1 from jsonb_array_elements(public_payload->'pairs') as pairs(pair_item)
      where not solution_payload->'paths' ? (pair_item->>'id')
        or jsonb_typeof(solution_payload->'paths'->(pair_item->>'id')) is distinct from 'array') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$$;

alter function private.validate_connect_pairs_question_document(jsonb) owner to postgres;
revoke all on function private.validate_connect_pairs_question_document(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.connect_pairs_answer_valid(public_payload jsonb, answer jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare
  pair jsonb;
  path jsonb;
  entry jsonb;
  pair_id text;
  cell integer;
  previous_cell integer;
  first_cell integer;
  endpoint_a integer;
  endpoint_b integer;
  board_rows integer;
  board_columns integer;
  cell_count integer;
  occupied integer[] := array[]::integer[];
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or public_payload->'requireFullCoverage' is distinct from 'true'::jsonb
    or jsonb_typeof(answer) is distinct from 'object' then return false; end if;
  if jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or public_payload->'grid'->>'rows' !~ '^[4-8]([.]0+)?$'
    or public_payload->'grid'->>'columns' !~ '^[4-8]([.]0+)?$'
    or (public_payload->'grid'->>'columns')::numeric <> (public_payload->'grid'->>'rows')::numeric then return false; end if;
  board_rows := (public_payload->'grid'->>'rows')::integer;
  board_columns := (public_payload->'grid'->>'columns')::integer;
  cell_count := board_rows * board_columns;
  if jsonb_typeof(public_payload->'pairs') is distinct from 'array'
    or jsonb_typeof(answer->'paths') is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(answer)) <> 1 then return false; end if;
  if jsonb_array_length(public_payload->'pairs') not between 3 and board_rows then return false; end if;
  if (select count(*) from jsonb_object_keys(answer->'paths')) <> jsonb_array_length(public_payload->'pairs') then
    return false;
  end if;
  for pair in select value from jsonb_array_elements(public_payload->'pairs') loop
    if jsonb_typeof(pair) is distinct from 'object'
      or jsonb_typeof(pair->'id') is distinct from 'string'
      or jsonb_typeof(pair->'endpoints') is distinct from 'array' then return false; end if;
    if jsonb_array_length(pair->'endpoints') <> 2 then return false; end if;
    for entry in select value from jsonb_array_elements(pair->'endpoints') loop
      if jsonb_typeof(entry) is distinct from 'number' then return false; end if;
      if (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and cell_count - 1 then return false; end if;
    end loop;
    pair_id := pair->>'id';
    endpoint_a := (pair->'endpoints'->>0)::integer;
    endpoint_b := (pair->'endpoints'->>1)::integer;
    if pair_id is null or endpoint_a is null or endpoint_b is null or endpoint_a = endpoint_b then return false; end if;
    path := answer->'paths'->pair_id;
    if jsonb_typeof(path) is distinct from 'array' then return false; end if;
    if jsonb_array_length(path) not between 2 and cell_count then return false; end if;
    previous_cell := null;
    first_cell := null;
    for entry in select value from jsonb_array_elements(path) loop
      if jsonb_typeof(entry) <> 'number' then return false; end if;
      if (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
        or (entry #>> '{}')::numeric not between 0 and cell_count - 1 then return false; end if;
      cell := (entry #>> '{}')::integer;
      if cell = any(occupied) then return false; end if;
      if previous_cell is not null and abs(cell / board_columns - previous_cell / board_columns)
        + abs(cell % board_columns - previous_cell % board_columns) <> 1 then
        return false;
      end if;
      first_cell := coalesce(first_cell,cell);
      previous_cell := cell;
      occupied := array_append(occupied,cell);
    end loop;
    if not ((first_cell = endpoint_a and previous_cell = endpoint_b)
      or (first_cell = endpoint_b and previous_cell = endpoint_a)) then return false; end if;
  end loop;
  return cardinality(occupied) = cell_count;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$$;
alter function private.connect_pairs_answer_valid(jsonb,jsonb) owner to postgres;
revoke all on function private.connect_pairs_answer_valid(jsonb,jsonb) from public,anon,authenticated,service_role;
