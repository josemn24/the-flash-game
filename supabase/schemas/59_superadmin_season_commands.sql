-- S10 — Prepare and activate a season from the private beta portal.
-- Mutations stay behind narrow Auth-backed wrappers; clients never receive table DML.

create function private.create_season_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  room_id_value uuid;
  title_value text;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  reason_value text;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  audit_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomId','title','startsAt','endsAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomId','title','startsAt','endsAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','roomId','title','startsAt','endsAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  title_value := btrim(input->>'title');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(title_value) not between 3 and 80
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;

  begin
    room_id_value := (input->>'roomId')::uuid;
    starts_at_value := (input->>'startsAt')::timestamptz;
    ends_at_value := (input->>'endsAt')::timestamptz;
  exception when others then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end;
  if starts_at_value >= ends_at_value then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomId', room_id_value,
    'title', title_value,
    'startsAt', starts_at_value,
    'endsAt', ends_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  perform 1 from public.rooms room where room.id = room_id_value and room.status = 'active' for update;
  if not found then
    raise exception 'room_not_found' using errcode = '22023';
  end if;

  insert into public.seasons(room_id, title, status, starts_at, ends_at)
  values (room_id_value, title_value, 'draft', starts_at_value, ends_at_value)
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  audit_payload := result;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_season', 'season', (result->>'seasonId')::uuid, reason_value, key,
    null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_season', safe_input, result);
  return result;
end;
$$;

create function private.update_season_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  title_value text;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  reason_value text;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  room_status text;
  safe_input jsonb;
  before_payload jsonb;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','title','startsAt','endsAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','title','startsAt','endsAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','title','startsAt','endsAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  title_value := btrim(input->>'title');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(title_value) not between 3 and 80
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;

  begin
    season_id_value := (input->>'seasonId')::uuid;
    starts_at_value := (input->>'startsAt')::timestamptz;
    ends_at_value := (input->>'endsAt')::timestamptz;
  exception when others then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end;
  if starts_at_value >= ends_at_value then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'title', title_value,
    'startsAt', starts_at_value,
    'endsAt', ends_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.*
  into season_row
  from public.seasons season
  join public.rooms room on room.id = season.room_id
  where season.id = season_id_value
  for update of season, room;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  select room.status into room_status from public.rooms room where room.id = season_row.room_id;
  if room_status <> 'active' then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if season_row.status <> 'draft' then
    raise exception 'season_not_draft' using errcode = '55000';
  end if;

  before_payload := jsonb_build_object(
    'seasonId', season_row.id,
    'roomId', season_row.room_id,
    'title', season_row.title,
    'status', season_row.status,
    'startsAt', season_row.starts_at,
    'endsAt', season_row.ends_at
  );
  update public.seasons
  set title = title_value, starts_at = starts_at_value, ends_at = ends_at_value
  where id = season_id_value
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'update_season', 'season', season_id_value, reason_value, key,
    before_payload, result
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_season', safe_input, result);
  return result;
end;
$$;

create function private.activate_season_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  reason_value text;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  room_status text;
  safe_input jsonb;
  before_payload jsonb;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;
  begin
    season_id_value := (input->>'seasonId')::uuid;
  exception when others then
    raise exception 'invalid_season' using errcode = '22023';
  end;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'activate_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.*
  into season_row
  from public.seasons season
  join public.rooms room on room.id = season.room_id
  where season.id = season_id_value
  for update of season, room;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  select room.status into room_status from public.rooms room where room.id = season_row.room_id;
  if room_status <> 'active' then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if season_row.status = 'active' then
    raise exception 'season_already_active' using errcode = '55000';
  end if;
  if season_row.status <> 'draft' then
    raise exception 'season_not_draft' using errcode = '55000';
  end if;
  if season_row.ends_at <= clock_timestamp() then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;
  if exists (
    select 1 from public.seasons other
    where other.room_id = season_row.room_id and other.status = 'active'
  ) then
    raise exception 'active_season_exists' using errcode = '23505';
  end if;

  before_payload := jsonb_build_object(
    'seasonId', season_row.id,
    'roomId', season_row.room_id,
    'title', season_row.title,
    'status', season_row.status,
    'startsAt', season_row.starts_at,
    'endsAt', season_row.ends_at
  );
  update public.seasons
  set status = 'active'
  where id = season_id_value
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'activate_season', 'season', season_id_value, reason_value, key,
    before_payload, result
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'activate_season', safe_input, result);
  return result;
end;
$$;

create function public.create_superadmin_season(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_season_command(input);
$$;

create function public.update_superadmin_season(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.update_season_command(input);
$$;

create function public.activate_superadmin_season(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.activate_season_command(input);
$$;

alter function private.create_season_command(jsonb) owner to postgres;
alter function private.update_season_command(jsonb) owner to postgres;
alter function private.activate_season_command(jsonb) owner to postgres;
alter function public.create_superadmin_season(jsonb) owner to postgres;
alter function public.update_superadmin_season(jsonb) owner to postgres;
alter function public.activate_superadmin_season(jsonb) owner to postgres;

revoke all on function private.create_season_command(jsonb), private.update_season_command(jsonb), private.activate_season_command(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.create_superadmin_season(jsonb), public.update_superadmin_season(jsonb), public.activate_superadmin_season(jsonb)
  from public, anon, service_role;
revoke execute on function public.create_superadmin_season(jsonb), public.update_superadmin_season(jsonb), public.activate_superadmin_season(jsonb)
  from service_role;
grant execute on function public.create_superadmin_season(jsonb), public.update_superadmin_season(jsonb), public.activate_superadmin_season(jsonb)
  to authenticated;
