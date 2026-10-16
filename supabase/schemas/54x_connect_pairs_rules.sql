-- Bounded public-rule validation. Any legal full-coverage solution is accepted.
create function private.connect_pairs_answer_valid(public_payload jsonb, answer jsonb) returns boolean
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
