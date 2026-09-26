-- F18 — Immutable Escape content validation used by editorial publication.

create function private.escape_content_valid(public_payload jsonb, solution_payload jsonb)
returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare
  grid jsonb := public_payload->'grid';
  blocks jsonb := public_payload->'initialBlocks';
  reference jsonb := solution_payload->'referenceSolution';
  ids text[] := '{}';
  kinds text[] := '{}';
  orientations text[] := '{}';
  rows integer[] := '{}';
  columns integer[] := '{}';
  lengths integer[] := '{}';
  occupied integer[] := '{}';
  target_index integer := null;
  exit_row integer;
  block jsonb;
  move jsonb;
  index integer;
  block_index integer;
  step_offset integer;
  position integer;
  cell integer;
  row_value integer;
  column_value integer;
  length_value integer;
  move_from integer;
  move_to integer;
  current_position integer;
  maximum_position integer;
  candidate_row integer;
  candidate_column integer;
  target_id text;
  kind_value text;
  orientation_value text;
  block_id text;
  collision boolean;
  target_column integer;
  optimal_moves integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'initialBlocks']
    or not solution_payload ?& array['referenceSolution', 'optimalMoves']
    or jsonb_typeof(grid) is distinct from 'object'
    or jsonb_typeof(grid->'rows') is distinct from 'number'
    or jsonb_typeof(grid->'columns') is distinct from 'number'
    or jsonb_typeof(grid->'exit') is distinct from 'object'
    or (grid->>'rows')::numeric <> 6
    or (grid->>'columns')::numeric <> 6
    or grid->'exit'->>'side' <> 'right'
    or jsonb_typeof(grid->'exit'->'row') is distinct from 'number'
    or (grid->'exit'->>'row')::numeric <> trunc((grid->'exit'->>'row')::numeric)
    or jsonb_typeof(blocks) is distinct from 'array'
    or jsonb_array_length(blocks) = 0
    or jsonb_typeof(reference) is distinct from 'array'
    or jsonb_typeof(solution_payload->'optimalMoves') is distinct from 'number'
    or (solution_payload->>'optimalMoves')::numeric <> trunc((solution_payload->>'optimalMoves')::numeric)
    or (solution_payload->>'optimalMoves')::integer <= 0 then
    return false;
  end if;

  exit_row := (grid->'exit'->>'row')::integer;
  if exit_row not between 0 and 5
    or jsonb_array_length(reference) <> (solution_payload->>'optimalMoves')::integer then
    return false;
  end if;
  optimal_moves := (solution_payload->>'optimalMoves')::integer;

  for block, index in
    select value, ordinality::integer from jsonb_array_elements(blocks) with ordinality
  loop
    if jsonb_typeof(block) is distinct from 'object'
      or not block ?& array['id', 'kind', 'orientation', 'row', 'column', 'length']
      or exists (select 1 from jsonb_object_keys(block) key_name where key_name <> all(array[
        'id', 'kind', 'orientation', 'row', 'column', 'length', 'label', 'symbol'
      ]))
      or jsonb_typeof(block->'id') is distinct from 'string'
      or btrim(block->>'id') = ''
      or jsonb_typeof(block->'kind') is distinct from 'string'
      or block->>'kind' not in ('target', 'obstacle')
      or jsonb_typeof(block->'orientation') is distinct from 'string'
      or block->>'orientation' not in ('horizontal', 'vertical')
      or jsonb_typeof(block->'row') is distinct from 'number'
      or (block->>'row')::numeric <> trunc((block->>'row')::numeric)
      or jsonb_typeof(block->'column') is distinct from 'number'
      or (block->>'column')::numeric <> trunc((block->>'column')::numeric)
      or jsonb_typeof(block->'length') is distinct from 'number'
      or (block->>'length')::numeric <> trunc((block->>'length')::numeric)
      or (block->>'length')::integer not in (2, 3)
      or (block ? 'label' and (jsonb_typeof(block->'label') is distinct from 'string'
        or char_length(block->>'label') > 500))
      or (block ? 'symbol' and (jsonb_typeof(block->'symbol') is distinct from 'string'
        or char_length(block->>'symbol') > 32)) then
      return false;
    end if;

    block_id := btrim(block->>'id');
    kind_value := block->>'kind';
    orientation_value := block->>'orientation';
    row_value := (block->>'row')::integer;
    column_value := (block->>'column')::integer;
    length_value := (block->>'length')::integer;
    if block_id = any(ids)
      or row_value < 0
      or column_value < 0
      or row_value + (case when orientation_value = 'vertical' then length_value else 1 end) > 6
      or column_value + (case when orientation_value = 'horizontal' then length_value else 1 end) > 6 then
      return false;
    end if;

    ids := ids || block_id;
    kinds := kinds || kind_value;
    orientations := orientations || orientation_value;
    rows := rows || row_value;
    columns := columns || column_value;
    lengths := lengths || length_value;
    if kind_value = 'target' then
      if target_index is not null then return false; end if;
      target_index := index;
      if orientation_value <> 'horizontal' or row_value <> exit_row then return false; end if;
    end if;

    for step_offset in 0..length_value - 1 loop
      cell := (row_value + case when orientation_value = 'vertical' then step_offset else 0 end) * 6
        + column_value + case when orientation_value = 'horizontal' then step_offset else 0 end;
      if cell = any(occupied) then return false; end if;
      occupied := occupied || cell;
    end loop;
  end loop;

  if target_index is null then return false; end if;
  target_column := columns[target_index];
  if target_column = 6 - lengths[target_index] then return false; end if;

  for move in select value from jsonb_array_elements(reference) loop
    if jsonb_typeof(move) is distinct from 'object'
      or not move ?& array['blockId', 'from', 'to']
      or exists (select 1 from jsonb_object_keys(move) key_name where key_name <> all(array['blockId', 'from', 'to']))
      or jsonb_typeof(move->'blockId') is distinct from 'string'
      or jsonb_typeof(move->'from') is distinct from 'number'
      or jsonb_typeof(move->'to') is distinct from 'number'
      or (move->>'from')::numeric <> trunc((move->>'from')::numeric)
      or (move->>'to')::numeric <> trunc((move->>'to')::numeric) then
      return false;
    end if;

    block_id := move->>'blockId';
    block_index := array_position(ids, block_id);
    if block_index is null then return false; end if;
    move_from := (move->>'from')::integer;
    move_to := (move->>'to')::integer;
    current_position := case when orientations[block_index] = 'horizontal'
      then columns[block_index] else rows[block_index] end;
    maximum_position := 6 - lengths[block_index];
    if move_from <> current_position
      or move_to = move_from
      or move_to not between 0 and maximum_position then
      return false;
    end if;

    collision := false;
    for position in least(move_from, move_to)..greatest(move_from, move_to) + lengths[block_index] - 1 loop
      candidate_row := case when orientations[block_index] = 'horizontal' then rows[block_index] else position end;
      candidate_column := case when orientations[block_index] = 'horizontal' then position else columns[block_index] end;
      for index in 1..coalesce(array_length(ids, 1), 0) loop
        if index <> block_index then
          for step_offset in 0..lengths[index] - 1 loop
            cell := (rows[index] + case when orientations[index] = 'vertical' then step_offset else 0 end) * 6
              + columns[index] + case when orientations[index] = 'horizontal' then step_offset else 0 end;
            if cell = candidate_row * 6 + candidate_column then collision := true; end if;
          end loop;
        end if;
      end loop;
    end loop;
    if collision then return false; end if;
    if orientations[block_index] = 'horizontal' then columns[block_index] := move_to;
    else rows[block_index] := move_to;
    end if;
  end loop;

  return rows[target_index] = exit_row and columns[target_index] = 6 - lengths[target_index];
end;
$$;

alter function private.escape_content_valid(jsonb, jsonb) owner to postgres;
revoke all on function private.escape_content_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;
