-- S12 — Tick del calendario y expiración de intentos inactivos.

create function private.expire_stale_attempts(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  run_id_value text;
  attempt_id_value uuid;
  room_slug_value text;
  now_value timestamptz;
  attempt_row public.attempts%rowtype;
  abandoned_count integer := 0;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'attempt_expiration_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['runId','attemptId','roomSlug'])
    )
    or jsonb_typeof(input->'runId') is distinct from 'string'
    or (input ? 'attemptId' and jsonb_typeof(input->'attemptId') is distinct from 'string')
    or (input ? 'roomSlug' and jsonb_typeof(input->'roomSlug') is distinct from 'string')
    or (input ? 'attemptId' and input ? 'roomSlug') then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;

  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;
  if input ? 'attemptId' then
    begin
      attempt_id_value := (input->>'attemptId')::uuid;
    exception when others then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end;
  end if;
  if input ? 'roomSlug' then
    room_slug_value := btrim(input->>'roomSlug');
    if char_length(room_slug_value) = 0 or char_length(room_slug_value) > 160 then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  for attempt_row in
    select attempt.*
    from public.attempts attempt
    join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
    join public.seasons season on season.id = schedule.season_id
    join public.rooms room on room.id = season.room_id
    where attempt.kind = 'competitive'
      and attempt.status = 'in_progress'
      and coalesce(attempt.last_activity_at, attempt.started_at) <= now_value - interval '15 minutes'
      and (private.publication_effective_status(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, now_value
      ) = 'closed' or attempt.deadline_at <= now_value)
      and (attempt_id_value is null or attempt.id = attempt_id_value)
      and (room_slug_value is null or room.slug = room_slug_value)
    order by attempt.id
    for update of attempt skip locked
  loop
    if private.close_attempt_as_abandoned(
      attempt_row.id,
      now_value,
      'inactivity_timeout',
      null,
      run_id_value || ':inactivity_timeout:' || attempt_row.id::text,
      '15 minutes without activity after challenge closure or deadline'
    ) then
      abandoned_count := abandoned_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'runId', run_id_value,
    'evaluatedAt', now_value,
    'abandonedAttempts', abandoned_count
  );
end;
$$;


create function private.run_calendar_tick_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
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
       or (schedule.status in ('scheduled', 'open') and schedule.closes_at <= now_value)
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
$$;


-- Private entrypoints remain available to transactional gameplay commands.
-- PostgREST hoists statement_timeout before each RPC. Keep expiration's independent
-- budget outside the calendar tick; tick also overrides authenticator's lock_timeout.
create function public.run_calendar_tick(input jsonb) returns jsonb
language sql volatile security invoker
set search_path = '' set statement_timeout = '0' set lock_timeout = '0' as $$
  select private.run_calendar_tick_command(input);
$$;


create function public.expire_stale_attempts(input jsonb) returns jsonb
language sql volatile security invoker
set search_path = '' set statement_timeout = '5s' as $$
  select private.expire_stale_attempts(input);
$$;

alter function private.expire_stale_attempts(jsonb) owner to postgres;
alter function private.run_calendar_tick_command(jsonb) owner to postgres;
alter function public.run_calendar_tick(jsonb) owner to postgres;
alter function public.expire_stale_attempts(jsonb) owner to postgres;
revoke all on function private.expire_stale_attempts(jsonb), private.run_calendar_tick_command(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.run_calendar_tick(jsonb), public.expire_stale_attempts(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.run_calendar_tick(jsonb), public.expire_stale_attempts(jsonb)
  to service_role;
