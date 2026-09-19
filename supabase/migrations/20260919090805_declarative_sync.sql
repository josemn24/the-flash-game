SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.queens_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
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
    or (public_payload->'grid'->>'rows')::integer <> 5
    or (public_payload->'grid'->>'columns')::integer <> 5
    or jsonb_typeof(public_payload->'regions') is distinct from 'array'
    or jsonb_array_length(public_payload->'regions') <> 25
    or jsonb_typeof(public_payload->'prefilledQueens') is distinct from 'array'
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
    or jsonb_array_length(solution_payload->'solution') <> 5
    or exists (
      select 1 from jsonb_array_elements(public_payload->'regions') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    )
    or exists (
      select 1 from jsonb_array_elements(public_payload->'prefilledQueens') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    )
    or exists (
      select 1 from jsonb_array_elements(solution_payload->'solution') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    ) then
    return false;
  end if;

  for value in select jsonb_array_elements_text(public_payload->'regions') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 4 then return false; end if;
    regions := regions || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(public_payload->'prefilledQueens') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 24 then return false; end if;
    prefilled := prefilled || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(solution_payload->'solution') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 24 then return false; end if;
    solution := solution || value::integer;
  end loop;
  for index in 0..4 loop
    if not exists (select 1 from unnest(regions) as region_cell where region_cell = index) then return false; end if;
    if exists (
      with recursive walk(cell) as (
        (select min(candidate)::integer
         from generate_series(0, 24) candidate
         where regions[candidate + 1] = index)
        union
        select neighbor::integer
        from walk
        cross join lateral unnest(array[
          walk.cell - 5, walk.cell + 5, walk.cell - 1, walk.cell + 1
        ]) neighbor
        where neighbor between 0 and 24
          and regions[neighbor + 1] = index
      )
      select 1
      from generate_series(0, 24) candidate
      where regions[candidate + 1] = index
        and not exists (select 1 from walk where walk.cell = candidate)
    ) then return false; end if;
  end loop;
  if (select count(distinct solution_cell) from unnest(solution) as solution_cell) <> coalesce(array_length(solution, 1), 0) then return false; end if;
  if (select count(distinct prefilled_cell) from unnest(prefilled) as prefilled_cell) <> coalesce(array_length(prefilled, 1), 0) then return false; end if;
  if exists (select 1 from unnest(prefilled) as prefilled_cell where not prefilled_cell = any(solution)) then return false; end if;
  if exists (
    select 1 from unnest(solution) as left_cell cross join unnest(solution) as right_cell
    where left_cell < right_cell
      and (left_cell / 5 = right_cell / 5
        or left_cell % 5 = right_cell % 5
        or regions[left_cell + 1] = regions[right_cell + 1]
        or greatest(abs(left_cell / 5 - right_cell / 5), abs(left_cell % 5 - right_cell % 5)) = 1)
  ) then return false; end if;
  for index in 0..4 loop
    if (select count(*) from unnest(solution) as solution_cell where solution_cell / 5 = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where solution_cell % 5 = index) <> 1
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
      search.used_regions || regions[search.row_no * 5 + candidate + 1]
    from search
    cross join generate_series(0, 4) candidate
    where search.row_no < 5
      and not candidate = any(search.used_columns)
      and not regions[search.row_no * 5 + candidate + 1] = any(search.used_regions)
      and (search.previous_column is null or abs(search.previous_column - candidate) > 1)
  )
  select count(*)::integer into solution_count from search where row_no = 5;
  if solution_count <> 1 then return false; end if;
  return true;
end;
$function$;
