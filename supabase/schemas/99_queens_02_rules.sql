-- E05 — Reglas, tablero y progreso de Queens.
-- Las tablas de eventos se declaran antes de compilar sus proyecciones.
set local check_function_bodies = off;

create function private.queens_board(target_attempt uuid, target_item uuid) returns integer[]
language sql stable security definer set search_path = '' as $$
  with fixed_cells as (
    select value::integer as cell
    from private.challenge_items i
    join private.question_versions q on q.id = i.question_version_id
    cross join jsonb_array_elements_text(coalesce(q.public_payload->'prefilledQueens', '[]'::jsonb)) value
    where i.id = target_item
  ),
  latest_actions as (
    select distinct on (e.cell) e.cell, e.action
    from private.queens_placement_events e
    where e.attempt_id = target_attempt and e.challenge_item_id = target_item
    order by e.cell, e.sequence desc
  )
  select coalesce(array_agg(cell order by cell), '{}'::integer[])
  from (
    select cell from fixed_cells
    union
    select cell from latest_actions where action = 'place'
  ) active_cells
$$;


create or replace function private.queens_content_valid(public_payload jsonb, solution_payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  board_size integer;
  cell_count integer;
  regions integer[] := '{}';
  prefilled integer[] := '{}';
  solution integer[] := '{}';
  value text;
  cell integer;
  index integer;
  solution_count integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
    or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
    or jsonb_typeof(public_payload->'regions') is distinct from 'array'
    or jsonb_typeof(public_payload->'prefilledQueens') is distinct from 'array'
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
  then
    return false;
  end if;

  board_size := (public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (public_payload->'grid'->>'columns')::integer <> board_size then
    return false;
  end if;
  cell_count := board_size * board_size;
  if jsonb_array_length(public_payload->'regions') <> cell_count
    or jsonb_array_length(solution_payload->'solution') <> board_size then
    return false;
  end if;

  if exists (
    select 1 from jsonb_array_elements(public_payload->'regions') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) or exists (
    select 1 from jsonb_array_elements(public_payload->'prefilledQueens') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) or exists (
    select 1 from jsonb_array_elements(solution_payload->'solution') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) then
    return false;
  end if;

  for value in select jsonb_array_elements_text(public_payload->'regions') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and board_size - 1 then return false; end if;
    regions := regions || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(public_payload->'prefilledQueens') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and cell_count - 1 then return false; end if;
    prefilled := prefilled || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(solution_payload->'solution') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and cell_count - 1 then return false; end if;
    solution := solution || value::integer;
  end loop;

  for index in 0..(board_size - 1) loop
    if not exists (select 1 from unnest(regions) as region_cell where region_cell = index) then return false; end if;
    if (
      with recursive walk(cell) as (
        (select min(candidate)::integer
         from generate_series(0, cell_count - 1) candidate
         where regions[candidate + 1] = index)
        union
        select neighbour
        from walk
        cross join lateral (
          select (walk.cell / board_size - 1) * board_size + walk.cell % board_size as neighbour
          where walk.cell / board_size > 0
          union all
          select (walk.cell / board_size + 1) * board_size + walk.cell % board_size
          where walk.cell / board_size < board_size - 1
          union all
          select (walk.cell / board_size) * board_size + walk.cell % board_size - 1
          where walk.cell % board_size > 0
          union all
          select (walk.cell / board_size) * board_size + walk.cell % board_size + 1
          where walk.cell % board_size < board_size - 1
        ) neighbours
        where regions[neighbour + 1] = index
      )
      select count(*) from walk
    ) <> (select count(*) from unnest(regions) as region_cell where region_cell = index) then
      return false;
    end if;
  end loop;

  if (select count(distinct solution_cell) from unnest(solution) as solution_cell) <> coalesce(array_length(solution, 1), 0)
    or (select count(distinct prefilled_cell) from unnest(prefilled) as prefilled_cell) <> coalesce(array_length(prefilled, 1), 0)
    or exists (select 1 from unnest(prefilled) as prefilled_cell where not prefilled_cell = any(solution)) then
    return false;
  end if;

  if exists (
    select 1 from unnest(solution) as left_cell cross join unnest(solution) as right_cell
    where left_cell < right_cell
      and (left_cell / board_size = right_cell / board_size
        or left_cell % board_size = right_cell % board_size
        or regions[left_cell + 1] = regions[right_cell + 1]
        or greatest(abs(left_cell / board_size - right_cell / board_size), abs(left_cell % board_size - right_cell % board_size)) = 1)
  ) then
    return false;
  end if;

  for index in 0..(board_size - 1) loop
    if (select count(*) from unnest(solution) as solution_cell where solution_cell / board_size = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where solution_cell % board_size = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where regions[solution_cell + 1] = index) <> 1 then
      return false;
    end if;
  end loop;

  with recursive search(row_no, previous_column, used_columns, used_regions) as (
    select 0, null::integer, '{}'::integer[], '{}'::integer[]
    union all
    select search.row_no + 1,
      candidate,
      search.used_columns || candidate,
      search.used_regions || regions[search.row_no * board_size + candidate + 1]
    from search
    cross join generate_series(0, board_size - 1) candidate
    where search.row_no < board_size
      and not candidate = any(search.used_columns)
      and not regions[search.row_no * board_size + candidate + 1] = any(search.used_regions)
      and (search.previous_column is null or abs(search.previous_column - candidate) > 1)
  )
  select count(*)::integer into solution_count
  from (select 1 from search where row_no = board_size limit 2) bounded_solutions;
  return solution_count = 1;
end;
$$;


create or replace function private.queens_cell_conflicts(regions jsonb, target_cell integer, queens integer[]) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  cell_count integer := jsonb_array_length(regions);
  board_size integer;
begin
  if cell_count is null or cell_count = 0 then return false; end if;
  board_size := sqrt(cell_count::numeric)::integer;
  if board_size * board_size <> cell_count or target_cell not between 0 and cell_count - 1 then return false; end if;
  return exists (
    select 1
    from unnest(queens) cell
    where cell <> target_cell
      and (
        target_cell / board_size = cell / board_size
        or target_cell % board_size = cell % board_size
        or regions->target_cell = regions->cell
        or greatest(
          abs(target_cell / board_size - cell / board_size),
          abs(target_cell % board_size - cell % board_size)
        ) = 1
      )
  );
end;
$$;


create or replace function private.queens_progress(target_attempt uuid, target_item uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  regions jsonb;
  draft jsonb;
  queens integer[];
  board_size integer;
  conflicting_queens integer;
  completed_rows integer;
  completed_columns integer;
  completed_regions integer;
  solved boolean;
  incorrect_validations integer;
  max_incorrect_validations integer;
begin
  select q.public_payload->'regions', (q.public_payload->'grid'->>'rows')::integer, a.progress_payload,
    case when cv.mode in ('pyramid', 'time-trial') then 3 else null end
    into regions, board_size, draft, max_incorrect_validations
  from public.attempts a
  join private.challenge_items i on i.id = target_item
  join private.question_versions q on q.id = i.question_version_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt;

  if jsonb_typeof(draft) = 'object'
    and draft->>'kind' = 'queens'
    and (draft->>'challengeItemId')::uuid = target_item
    and jsonb_typeof(draft->'queens') = 'array' then
    select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
      into queens
    from jsonb_array_elements_text(draft->'queens') value;
  else
    queens := private.queens_board(target_attempt, target_item);
  end if;

  with pairs as (
    select left_cell as cell, right_cell
    from unnest(queens) left_cell
    cross join unnest(queens) right_cell
    where left_cell < right_cell
  ), conflicts as (
    select p.cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
    union
    select p.right_cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
  )
  select count(*)::integer into conflicting_queens from conflicts;

  select count(*)::integer into completed_rows
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell / board_size = group_no) = 1;
  select count(*)::integer into completed_columns
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell % board_size = group_no) = 1;
  select count(*)::integer into completed_regions
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where (regions->cell)::integer = group_no) = 1;

  solved := coalesce(array_length(queens, 1), 0) = board_size
    and completed_rows = board_size
    and completed_columns = board_size
    and completed_regions = board_size
    and conflicting_queens = 0;

  select count(*)::integer into incorrect_validations
  from private.queens_validation_events e
  where e.attempt_id = target_attempt and e.challenge_item_id = target_item and not e.correct;

  return jsonb_build_object(
    'kind', 'queens',
    'incorrectValidations', incorrect_validations,
    'maxIncorrectValidations', max_incorrect_validations,
    'queens', to_jsonb(queens),
    'placedQueens', coalesce(array_length(queens, 1), 0),
    'completedRows', completed_rows,
    'completedColumns', completed_columns,
    'completedRegions', completed_regions,
    'conflictingQueens', conflicting_queens,
    'solved', solved
  );
end;
$$;


create or replace function private.queens_answer(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'queens', private.queens_progress(target_attempt, target_item)->'queens',
    'marks', '[]'::jsonb
  )
$$;

alter function private.queens_board(uuid, uuid) owner to postgres;
alter function private.queens_content_valid(jsonb, jsonb) owner to postgres;
alter function private.queens_cell_conflicts(jsonb, integer, integer[]) owner to postgres;
alter function private.queens_progress(uuid, uuid) owner to postgres;
alter function private.queens_answer(uuid, uuid) owner to postgres;
revoke all on function private.queens_board(uuid, uuid), private.queens_content_valid(jsonb, jsonb), private.queens_cell_conflicts(jsonb, integer, integer[]),
  private.queens_progress(uuid, uuid), private.queens_answer(uuid, uuid)
  from public, anon, authenticated, service_role;
