SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.activate_season_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  where season.id = season_id_value;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  perform 1 from public.rooms room where room.id=season_row.room_id for update;
  select * into season_row from public.seasons where id=season_id_value for update;
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
$function$;

CREATE OR REPLACE FUNCTION private.run_calendar_tick_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  run_id_value text;
  now_value timestamptz;
  room_id_value uuid;
  schedule_row public.scheduled_challenges%rowtype;
  season_row public.seasons%rowtype;
  opened_count integer := 0;
  closed_count integer := 0;
  finished_count integer := 0;
  abandoned_count integer := 0;
  expiration_result jsonb;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'calendar_tick_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> 'runId')
    or jsonb_typeof(input->'runId') is distinct from 'string' then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;
  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  -- Administrative commands and the tick always acquire room, then season,
  -- then publication locks. This avoids cross-slice deadlocks.
  for room_id_value in
    select distinct season.room_id
    from public.seasons season
    left join public.scheduled_challenges schedule on schedule.season_id = season.id
    where (season.status = 'active' and season.ends_at <= now_value)
       or (season.status <> 'draft' and schedule.status in ('scheduled', 'open') and schedule.closes_at <= now_value)
    order by season.room_id
  loop
    perform 1 from public.rooms room where room.id = room_id_value for update;
  end loop;

  for season_row in
    select season.*
    from public.seasons season
    where (season.status = 'active' and season.ends_at <= now_value)
       or exists (
         select 1 from public.scheduled_challenges schedule
         where schedule.season_id = season.id
           and season.status <> 'draft'
           and schedule.status in ('scheduled', 'open')
           and schedule.closes_at <= now_value
       )
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status in ('scheduled', 'open')
      and season.status <> 'draft'
      and schedule.closes_at <= now_value
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'closed'
    where id = schedule_row.id and status in ('scheduled', 'open') and closes_at <= now_value;
    if found then
      closed_count := closed_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'close_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', schedule_row.status), jsonb_build_object('status', 'closed')
      );
    end if;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status = 'scheduled'
      and schedule.opens_at <= now_value and now_value < schedule.closes_at
      and season.status = 'active'
      and season.starts_at <= now_value and now_value < season.ends_at
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'open'
    where id = schedule_row.id and status = 'scheduled'
      and opens_at <= now_value and now_value < closes_at;
    if found then
      opened_count := opened_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'open_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'scheduled'), jsonb_build_object('status', 'open')
      );
    end if;
  end loop;

  for season_row in
    select season.* from public.seasons season
    where season.status = 'active' and season.ends_at <= now_value
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
    update public.seasons set status = 'finished'
    where id = season_row.id and status = 'active' and ends_at <= now_value;
    if found then
      finished_count := finished_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'finish_season', 'season', season_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'active'), jsonb_build_object('status', 'finished')
      );
    end if;
  end loop;

  select private.expire_stale_attempts(jsonb_build_object('runId', run_id_value))
    into expiration_result;
  abandoned_count := (expiration_result->>'abandonedAttempts')::integer;

  return jsonb_build_object(
    'runId', run_id_value, 'evaluatedAt', now_value,
    'opened', opened_count, 'closed', closed_count, 'finishedSeasons', finished_count,
    'abandonedAttempts', abandoned_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_season_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
      where key_name <> all(array['idempotencyKey','seasonId','title','startsAt','endsAt','reason','expectedUpdatedAt'])
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
  if input ? 'expectedUpdatedAt' then safe_input:=safe_input||jsonb_build_object('expectedUpdatedAt',(input->>'expectedUpdatedAt')::timestamptz); end if;
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
  where season.id = season_id_value;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  perform 1 from public.rooms room where room.id=season_row.room_id for update;
  select * into season_row from public.seasons where id=season_id_value for update;
  if input ? 'expectedUpdatedAt' and (input->>'expectedUpdatedAt')::timestamptz is distinct from season_row.updated_at then raise exception 'schedule_conflict' using errcode='40001'; end if;
  select room.status into room_status from public.rooms room where room.id = season_row.room_id;
  if room_status <> 'active' then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if season_row.status<>'draft' and title_value<>season_row.title then raise exception 'season_not_draft' using errcode='55000'; end if;
  perform private.assert_season_calendar_window(season_row,starts_at_value,ends_at_value,clock_timestamp());

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
  where id = season_id_value and (title,starts_at,ends_at) is distinct from (title_value,starts_at_value,ends_at_value)
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;
  if not found then
    result:=before_payload;
    insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'update_season',safe_input,result);
    return result;
  end if;

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
$function$;
