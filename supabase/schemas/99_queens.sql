-- E05 — Authoritative Queens placement events and command.

create table private.queens_placement_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  cell integer not null check (cell between 0 and 24),
  action text not null check (action in ('place', 'remove')),
  conflicting boolean not null,
  penalty_applied boolean not null,
  penalty_points integer not null check (penalty_points >= 0),
  received_at timestamptz not null,
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id) on delete restrict,
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id) on delete restrict,
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (received_at >= presented_at),
  check (not penalty_applied or (action = 'place' and conflicting and penalty_points > 0)),
  check (penalty_applied or penalty_points = 0)
);

create index queens_placement_events_item_idx
  on private.queens_placement_events(attempt_id, challenge_item_id, sequence);
create index queens_placement_events_cell_idx
  on private.queens_placement_events(attempt_id, challenge_item_id, cell, sequence desc);

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

create function private.queens_content_valid(public_payload jsonb, solution_payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
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
$$;

create function private.queens_cell_conflicts(regions jsonb, target_cell integer, queens integer[])
returns boolean
language sql immutable set search_path = '' as $$
  with target as (
    select target_cell / 5 as row_no, target_cell % 5 as column_no,
      regions->target_cell as region
  ), others as (
    select cell, cell / 5 as row_no, cell % 5 as column_no, regions->cell as region
    from unnest(queens) cell
    where cell <> target_cell
  )
  select exists (
    select 1 from target t join others o on
      t.row_no = o.row_no or
      t.column_no = o.column_no or
      t.region = o.region or
      greatest(abs(t.row_no - o.row_no), abs(t.column_no - o.column_no)) = 1
  )
$$;

create function private.queens_progress(target_attempt uuid, target_item uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  regions jsonb;
  queens integer[];
  conflicting_queens integer;
  completed_rows integer;
  completed_columns integer;
  completed_regions integer;
  solved boolean;
begin
  select q.public_payload->'regions' into regions
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item;
  queens := private.queens_board(target_attempt, target_item);

  with pairs as (
    select left_cell as cell, right_cell
    from unnest(queens) left_cell
    cross join unnest(queens) right_cell
    where left_cell < right_cell
  ), conflicts as (
    select p.cell
    from pairs p
    where p.cell / 5 = p.right_cell / 5
       or p.cell % 5 = p.right_cell % 5
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / 5 - p.right_cell / 5), abs(p.cell % 5 - p.right_cell % 5)) = 1
    union
    select p.right_cell
    from pairs p
    where p.cell / 5 = p.right_cell / 5
       or p.cell % 5 = p.right_cell % 5
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / 5 - p.right_cell / 5), abs(p.cell % 5 - p.right_cell % 5)) = 1
  )
  select count(*)::integer into conflicting_queens from conflicts;

  select count(*)::integer into completed_rows
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where cell / 5 = group_no) = 1;
  select count(*)::integer into completed_columns
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where cell % 5 = group_no) = 1;
  select count(*)::integer into completed_regions
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where (regions->cell)::integer = group_no) = 1;

  solved := coalesce(array_length(queens, 1), 0) = 5
    and completed_rows = 5 and completed_columns = 5 and completed_regions = 5
    and conflicting_queens = 0;

  return jsonb_build_object(
    'kind', 'queens',
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

create function private.queens_answer(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'queens', private.queens_progress(target_attempt, target_item)->'queens',
    'marks', '[]'::jsonb
  )
$$;

create function private.submit_queens_placement(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  event private.queens_placement_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  cell integer;
  action text;
  current_queens integer[];
  next_queens integer[];
  progress jsonb;
  conflicting boolean;
  penalty boolean;
  penalty_points integer;
  sequence_no integer;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action'
    ]))
    or jsonb_typeof(input->'cell') is distinct from 'number'
    or (input->>'cell')::numeric <> trunc((input->>'cell')::numeric)
    or input->>'action' not in ('place', 'remove') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  cell := (input->>'cell')::integer;
  action := input->>'action';
  if cell not between 0 and 24 then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_placement' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  current_queens := private.queens_board(a.id, item.id);
  if action = 'remove' and cell = any(coalesce((select array_agg(value::integer) from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value), '{}'::integer[])) then
    raise exception 'prefilled_queen_locked' using errcode = '55000';
  end if;
  if action = 'place' and cell = any(current_queens) then raise exception 'duplicate_queens_placement' using errcode = '55000'; end if;
  if action = 'remove' and not cell = any(current_queens) then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  next_queens := case when action = 'place' then current_queens || cell else array_remove(current_queens, cell) end;
  conflicting := action = 'place' and private.queens_cell_conflicts(question.public_payload->'regions', cell, next_queens);
  penalty := conflicting;
  penalty_points := case when penalty then round(item.points * 0.05)::integer else 0 end;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_placement_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  insert into private.queens_placement_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, cell, action,
    conflicting, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, cell, action,
    conflicting, penalty, penalty_points, instant, presented, used_ms, key)
  returning * into event;
  progress := private.queens_progress(a.id, item.id);
  terminal := (progress->>'solved')::boolean;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'cell', event.cell, 'action', event.action, 'conflicting', event.conflicting,
    'penaltyApplied', event.penalty_applied, 'terminal', terminal,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_placement', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'cell', cell, 'action', action),
      jsonb_build_object('lockVersion', a.lock_version, 'terminal', terminal, 'penaltyApplied', penalty));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_placement', safe_input, result);
  return result;
end;
$$;

alter function private.queens_board(uuid, uuid) owner to postgres;
alter function private.queens_content_valid(jsonb, jsonb) owner to postgres;
alter function private.queens_cell_conflicts(jsonb, integer, integer[]) owner to postgres;
alter function private.queens_progress(uuid, uuid) owner to postgres;
alter function private.queens_answer(uuid, uuid) owner to postgres;
alter function private.submit_queens_placement(jsonb) owner to postgres;
revoke all on table private.queens_placement_events from public, anon, authenticated, service_role;
alter table private.queens_placement_events enable row level security;
revoke all on function private.queens_board(uuid, uuid), private.queens_content_valid(jsonb, jsonb), private.queens_cell_conflicts(jsonb, integer, integer[]),
  private.queens_progress(uuid, uuid), private.queens_answer(uuid, uuid), private.submit_queens_placement(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.submit_queens_placement(jsonb) to service_role;
