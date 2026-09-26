-- F16 — Immutable Zip content validation used by editorial publication.

create function private.zip_content_valid(public_payload jsonb, solution_payload jsonb)
returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare
  checkpoints integer[] := '{}';
  solution integer[] := '{}';
  checkpoint_count integer;
  index integer;
  entry jsonb;
  cell integer;
  previous_cell integer;
  next_checkpoint integer := 2;
  checkpoint_at_cell integer;
  solution_count integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> 5
    or (public_payload->'grid'->>'columns')::numeric <> 5
    or jsonb_typeof(public_payload->'checkpoints') is distinct from 'array'
    or jsonb_array_length(public_payload->'checkpoints') not between 2 and 25
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
    or jsonb_array_length(solution_payload->'solution') <> 25 then
    return false;
  end if;

  for entry, index in
    select value, ordinality::integer
    from jsonb_array_elements(public_payload->'checkpoints') with ordinality
  loop
    if jsonb_typeof(entry) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(entry) key_name where key_name <> all(array['value', 'cell', 'label']))
      or jsonb_typeof(entry->'value') is distinct from 'number'
      or jsonb_typeof(entry->'cell') is distinct from 'number'
      or (entry->>'value')::numeric <> trunc((entry->>'value')::numeric)
      or (entry->>'cell')::numeric <> trunc((entry->>'cell')::numeric)
      or (entry->>'value')::integer <> index
      or (entry->>'cell')::integer not between 0 and 24
      or (entry ? 'label' and (jsonb_typeof(entry->'label') is distinct from 'string'
        or char_length(btrim(entry->>'label')) not between 1 and 500)) then
      return false;
    end if;
    cell := (entry->>'cell')::integer;
    if cell = any(checkpoints) then return false; end if;
    checkpoints := checkpoints || cell;
  end loop;
  checkpoint_count := coalesce(array_length(checkpoints, 1), 0);

  for entry in select value from jsonb_array_elements(solution_payload->'solution') loop
    if jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
      or (entry #>> '{}')::integer not between 0 and 24 then
      return false;
    end if;
    cell := (entry #>> '{}')::integer;
    if cell = any(solution) then return false; end if;
    solution := solution || cell;
  end loop;

  if solution[1] <> checkpoints[1] or solution[25] <> checkpoints[checkpoint_count] then
    return false;
  end if;
  for index in 2..25 loop
    previous_cell := solution[index - 1];
    cell := solution[index];
    if abs(previous_cell / 5 - cell / 5) + abs(previous_cell % 5 - cell % 5) <> 1 then
      return false;
    end if;
    checkpoint_at_cell := array_position(checkpoints, cell);
    if checkpoint_at_cell is not null then
      if checkpoint_at_cell <> next_checkpoint or
         (checkpoint_at_cell = checkpoint_count and index <> 25) then
        return false;
      end if;
      next_checkpoint := next_checkpoint + 1;
    end if;
  end loop;
  if next_checkpoint <> checkpoint_count + 1 then return false; end if;

  with recursive walk(cell, depth, next_checkpoint, visited) as (
    select checkpoints[1], 1, 2, array[checkpoints[1]]
    union all
    select candidate.cell,
      walk.depth + 1,
      case
        when array_position(checkpoints, candidate.cell) = walk.next_checkpoint
          then walk.next_checkpoint + 1
        else walk.next_checkpoint
      end,
      walk.visited || candidate.cell
    from walk
    cross join lateral generate_series(0, 24) candidate(cell)
    where walk.depth < 25
      and not candidate.cell = any(walk.visited)
      and abs(walk.cell / 5 - candidate.cell / 5) + abs(walk.cell % 5 - candidate.cell % 5) = 1
      and (array_position(checkpoints, candidate.cell) is null
        or array_position(checkpoints, candidate.cell) = walk.next_checkpoint)
      and (candidate.cell <> checkpoints[checkpoint_count] or walk.depth = 24)
  )
  select count(*)::integer into solution_count
  from (select 1 from walk
    where walk.depth = 25 and walk.cell = checkpoints[checkpoint_count]
      and walk.next_checkpoint = checkpoint_count + 1
    limit 2) candidates;
  return solution_count = 1;
end;
$$;

alter function private.zip_content_valid(jsonb, jsonb) owner to postgres;
revoke all on function private.zip_content_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;
