-- Generated from the declarative S12 schema plus the effective-clock helpers
-- required by the public read and gameplay boundaries.
create function private.publication_effective_status(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns text
language sql stable set search_path = '' as $$
  select case
    when raw_status = 'cancelled' then 'cancelled'
    when raw_status = 'closed' then 'closed'
    when season_status <> 'active' then 'closed'
    when at_time < season_starts_at or at_time < opens_at then 'upcoming'
    when at_time >= season_ends_at or at_time >= closes_at then 'closed'
    else 'available'
  end
$$;

create function private.publication_is_effectively_open(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns boolean
language sql stable set search_path = '' as $$
  select private.publication_effective_status(
    raw_status, season_status, season_starts_at, season_ends_at,
    opens_at, closes_at, at_time
  ) = 'available'
$$;

-- S12 — Schedule published Flash content and reconcile the local calendar.
-- Administrative writes use the existing publication table; no client DML is exposed.

create function private.assert_supported_calendar_content(version_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  version_status text;
  version_mode text;
  version_schema integer;
  version_score integer;
  version_config jsonb;
  item_count integer;
  compatible_item_count integer;
  solution_count integer;
begin
  select version.status, version.mode, version.config_schema_version, version.max_score, version.mode_config
    into version_status, version_mode, version_schema, version_score, version_config
  from private.challenge_versions version
  where version.id = version_id;

  if not found then
    raise exception 'content_not_found' using errcode = '22023';
  end if;
  if version_status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_mode <> 'flash' then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;

  select count(*)::integer,
    count(*) filter (
      where item.position in (1, 2)
        and item.points = 50
        and item.config_schema_version = 1
        and item.mode_config = '{}'::jsonb
        and question.status = 'published'
        and question.type = 'multiple-choice'
        and question.payload_schema_version = 1
        and jsonb_typeof(question.public_payload) = 'object'
        and not private.editorial_has_secret_key(question.public_payload)
        and jsonb_typeof(question.public_payload->'question') = 'string'
        and char_length(btrim(question.public_payload->>'question')) > 0
        and jsonb_typeof(question.public_payload->'options') = 'array'
        and case when jsonb_typeof(question.public_payload->'options') = 'array'
          then jsonb_array_length(question.public_payload->'options') >= 2 else false end
        and not exists (
          select 1
          from jsonb_array_elements(
            case when jsonb_typeof(question.public_payload->'options') = 'array'
              then question.public_payload->'options' else '[]'::jsonb end
          ) option(value)
          where jsonb_typeof(option.value) is distinct from 'string'
            or char_length(btrim(option.value #>> '{}')) = 0
        )
        and (select count(distinct option_value)
             from jsonb_array_elements_text(
               case when jsonb_typeof(question.public_payload->'options') = 'array'
                 then question.public_payload->'options' else '[]'::jsonb end
             ) option_value)
             = case when jsonb_typeof(question.public_payload->'options') = 'array'
                 then jsonb_array_length(question.public_payload->'options') else -1 end
        and (select count(*) from private.question_version_solutions solution
             where solution.question_version_id = question.id) = 1
        and exists (
          select 1
          from private.question_version_solutions solution
          where solution.question_version_id = question.id
            and jsonb_typeof(solution.solution_payload) = 'object'
            and jsonb_typeof(solution.solution_payload->'correctAnswer') = 'string'
            and exists (
              select 1 from jsonb_array_elements_text(
                case when jsonb_typeof(question.public_payload->'options') = 'array'
                  then question.public_payload->'options' else '[]'::jsonb end
              ) option_value
              where option_value = solution.solution_payload->>'correctAnswer'
            )
        )
    )::integer
  into item_count, compatible_item_count
  from private.challenge_items item
  left join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = version_id;

  select count(*)::integer into solution_count
  from private.challenge_items item
  join private.question_version_solutions solution
    on solution.question_version_id = item.question_version_id
  where item.challenge_version_id = version_id;

  if version_schema <> 1 or version_score <> 100 or version_config <> '{}'::jsonb or item_count <> 2
    or compatible_item_count <> 2 or solution_count <> 2 then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;
end;
$$;

create function private.create_scheduled_challenge_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  challenge_version_id_value uuid;
  number_value integer;
  opens_at_value timestamptz;
  closes_at_value timestamptz;
  reason_value text;
  now_value timestamptz;
  room_id_value uuid;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  result jsonb;
  safe_input jsonb;
  audit_payload jsonb;
  schedule_id uuid;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if jsonb_typeof(input->'number') is distinct from 'number'
    or (input->>'number') !~ '^[0-9]+$'
    or char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  begin
    season_id_value := (input->>'seasonId')::uuid;
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    number_value := (input->>'number')::integer;
    opens_at_value := (input->>'opensAt')::timestamptz;
    closes_at_value := (input->>'closesAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if number_value <= 0 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'challengeVersionId', challenge_version_id_value,
    'number', number_value,
    'opensAt', opens_at_value,
    'closesAt', closes_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_scheduled_challenge' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.room_id into room_id_value
  from public.seasons season where season.id = season_id_value;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  perform 1 from public.rooms room where room.id = room_id_value for update;
  if not found then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  select season.* into season_row from public.seasons season
  where season.id = season_id_value for update;
  if season_row.status <> 'active' then
    raise exception 'season_not_active' using errcode = '55000';
  end if;
  if not exists (select 1 from public.rooms room where room.id = room_id_value and room.status = 'active') then
    raise exception 'room_not_found' using errcode = '22023';
  end if;

  now_value := clock_timestamp();
  if opens_at_value >= closes_at_value
    or season_row.starts_at > opens_at_value
    or closes_at_value > season_row.ends_at
    or closes_at_value <= now_value then
    raise exception 'invalid_schedule_dates' using errcode = '22007';
  end if;
  perform private.assert_supported_calendar_content(challenge_version_id_value);

  begin
    insert into public.scheduled_challenges(
      season_id, challenge_version_id, number, status, opens_at, closes_at
    ) values (
      season_id_value, challenge_version_id_value, number_value, 'scheduled', opens_at_value, closes_at_value
    ) returning id into schedule_id;
  exception
    when unique_violation then
      raise exception 'schedule_number_conflict' using errcode = '23505';
    when exclusion_violation then
      raise exception 'schedule_overlap' using errcode = '23P01';
  end;

  select jsonb_build_object(
    'scheduledChallengeId', schedule.id,
    'roomId', season.room_id,
    'seasonId', schedule.season_id,
    'challengeVersionId', schedule.challenge_version_id,
    'number', schedule.number,
    'status', schedule.status,
    'opensAt', schedule.opens_at,
    'closesAt', schedule.closes_at,
    'updatedAt', schedule.updated_at
  ) into result
  from public.scheduled_challenges schedule
  join public.seasons season on season.id = schedule.season_id
  where schedule.id = schedule_id;

  audit_payload := jsonb_build_object(
    'status', 'scheduled', 'number', number_value,
    'opensAt', opens_at_value, 'closesAt', closes_at_value
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_scheduled_challenge', 'scheduled_challenge', schedule_id, reason_value, key,
    null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_scheduled_challenge', safe_input, result);
  return result;
end;
$$;

create function private.update_scheduled_challenge_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  schedule_id_value uuid;
  expected_updated_at_value timestamptz;
  challenge_version_id_value uuid;
  number_value integer;
  opens_at_value timestamptz;
  closes_at_value timestamptz;
  reason_value text;
  now_value timestamptz;
  room_id_value uuid;
  season_id_value uuid;
  cached private.command_requests%rowtype;
  schedule_row public.scheduled_challenges%rowtype;
  season_row public.seasons%rowtype;
  result jsonb;
  before_payload jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if jsonb_typeof(input->'number') is distinct from 'number'
    or (input->>'number') !~ '^[0-9]+$'
    or char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  begin
    schedule_id_value := (input->>'scheduledChallengeId')::uuid;
    expected_updated_at_value := (input->>'expectedUpdatedAt')::timestamptz;
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    number_value := (input->>'number')::integer;
    opens_at_value := (input->>'opensAt')::timestamptz;
    closes_at_value := (input->>'closesAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if number_value <= 0 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'scheduledChallengeId', schedule_id_value,
    'expectedUpdatedAt', expected_updated_at_value, 'challengeVersionId', challenge_version_id_value,
    'number', number_value, 'opensAt', opens_at_value, 'closesAt', closes_at_value, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_scheduled_challenge' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select schedule.season_id into season_id_value
  from public.scheduled_challenges schedule where schedule.id = schedule_id_value;
  if not found then raise exception 'schedule_not_found' using errcode = '22023'; end if;
  select season.room_id into room_id_value from public.seasons season where season.id = season_id_value;
  if not found then raise exception 'season_not_found' using errcode = '22023'; end if;
  perform 1 from public.rooms room where room.id = room_id_value for update;
  if not found then raise exception 'room_not_found' using errcode = '22023'; end if;
  select season.* into season_row from public.seasons season where season.id = season_id_value for update;
  select schedule.* into schedule_row from public.scheduled_challenges schedule
  where schedule.id = schedule_id_value for update;
  if schedule_row.status = 'open' then raise exception 'schedule_already_open' using errcode = '55000'; end if;
  if schedule_row.status <> 'scheduled' then raise exception 'schedule_not_editable' using errcode = '55000'; end if;
  if schedule_row.updated_at <> expected_updated_at_value then
    raise exception 'schedule_conflict' using errcode = '40001';
  end if;
  now_value := clock_timestamp();
  if now_value >= schedule_row.opens_at then raise exception 'schedule_already_open' using errcode = '55000'; end if;
  if season_row.status <> 'active' then raise exception 'season_not_active' using errcode = '55000'; end if;
  if not exists (select 1 from public.rooms room where room.id = room_id_value and room.status = 'active') then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if opens_at_value <= now_value or opens_at_value >= closes_at_value
    or season_row.starts_at > opens_at_value or closes_at_value > season_row.ends_at
    or closes_at_value <= now_value then
    raise exception 'invalid_schedule_dates' using errcode = '22007';
  end if;
  perform private.assert_supported_calendar_content(challenge_version_id_value);

  before_payload := jsonb_build_object(
    'status', schedule_row.status, 'number', schedule_row.number,
    'challengeVersionId', schedule_row.challenge_version_id,
    'opensAt', schedule_row.opens_at, 'closesAt', schedule_row.closes_at
  );
  begin
    update public.scheduled_challenges
    set challenge_version_id = challenge_version_id_value,
        number = number_value, opens_at = opens_at_value, closes_at = closes_at_value
    where id = schedule_id_value;
  exception
    when unique_violation then raise exception 'schedule_number_conflict' using errcode = '23505';
    when exclusion_violation then raise exception 'schedule_overlap' using errcode = '23P01';
  end;
  select jsonb_build_object(
    'scheduledChallengeId', schedule.id, 'roomId', season.room_id,
    'seasonId', schedule.season_id, 'challengeVersionId', schedule.challenge_version_id,
    'number', schedule.number, 'status', schedule.status,
    'opensAt', schedule.opens_at, 'closesAt', schedule.closes_at, 'updatedAt', schedule.updated_at
  ) into result
  from public.scheduled_challenges schedule join public.seasons season on season.id = schedule.season_id
  where schedule.id = schedule_id_value;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'update_scheduled_challenge', 'scheduled_challenge', schedule_id_value, reason_value, key,
    before_payload, jsonb_build_object(
      'status', 'scheduled', 'number', number_value, 'challengeVersionId', challenge_version_id_value,
      'opensAt', opens_at_value, 'closesAt', closes_at_value
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_scheduled_challenge', safe_input, result);
  return result;
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

  return jsonb_build_object(
    'runId', run_id_value, 'evaluatedAt', now_value,
    'opened', opened_count, 'closed', closed_count, 'finishedSeasons', finished_count
  );
end;
$$;

create function public.get_superadmin_calendar_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.status = 'active' and version.status = 'published' and version.mode = 'flash'
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_room_calendar(target_room_slug text)
returns table (
  room_id uuid,
  room_slug text,
  room_title text,
  time_zone text,
  membership_role text,
  season_id uuid,
  season_title text,
  season_status text,
  publication_id uuid,
  publication_number integer,
  publication_status text,
  availability_status text,
  opens_at timestamptz,
  closes_at timestamptz,
  challenge_title text,
  challenge_subtitle text,
  challenge_mode text,
  question_count bigint,
  own_attempt_status text,
  can_start boolean,
  can_continue boolean
)
language sql stable security definer set search_path = '' as $$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and version.mode_config = '{}'::jsonb and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      count(*) = 2
        and coalesce(bool_and(item.position in (1, 2)), false)
        and coalesce(bool_and(item.points = 50), false)
        and coalesce(bool_and(item.config_schema_version = 1 and item.mode_config = '{}'::jsonb), false)
        and count(*) filter (
          where question.status = 'published'
            and question.type = 'multiple-choice'
            and question.payload_schema_version = 1
            and jsonb_typeof(question.public_payload) = 'object'
            and not private.editorial_has_secret_key(question.public_payload)
            and jsonb_typeof(question.public_payload->'question') = 'string'
            and char_length(btrim(question.public_payload->>'question')) > 0
            and case when jsonb_typeof(question.public_payload->'options') = 'array'
              then jsonb_array_length(question.public_payload->'options') >= 2 else false end
            and not exists (
              select 1
              from jsonb_array_elements(
                case when jsonb_typeof(question.public_payload->'options') = 'array'
                  then question.public_payload->'options' else '[]'::jsonb end
              ) option(value)
              where jsonb_typeof(option.value) is distinct from 'string'
                or char_length(btrim(option.value #>> '{}')) = 0
            )
            and (select count(distinct option_value)
                 from jsonb_array_elements_text(
                   case when jsonb_typeof(question.public_payload->'options') = 'array'
                     then question.public_payload->'options' else '[]'::jsonb end
                 ) option_value)
                = case when jsonb_typeof(question.public_payload->'options') = 'array'
                    then jsonb_array_length(question.public_payload->'options') else -1 end
            and (select count(*) from private.question_version_solutions solution
                 where solution.question_version_id = question.id) = 1
            and exists (
              select 1
              from private.question_version_solutions solution
              where solution.question_version_id = question.id
                and jsonb_typeof(solution.solution_payload) = 'object'
                and jsonb_typeof(solution.solution_payload->'correctAnswer') = 'string'
                and exists (
                  select 1 from jsonb_array_elements_text(
                    case when jsonb_typeof(question.public_payload->'options') = 'array'
                      then question.public_payload->'options' else '[]'::jsonb end
                  ) option_value
                  where option_value = solution.solution_payload->>'correctAnswer'
                )
            )
        ) = 2 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status = 'published'
    and version.mode = 'flash'
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
$$;

create function public.create_superadmin_scheduled_challenge(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_scheduled_challenge_command(input);
$$;

create function public.update_superadmin_scheduled_challenge(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.update_scheduled_challenge_command(input);
$$;

alter function private.assert_supported_calendar_content(uuid) owner to postgres;
alter function private.create_scheduled_challenge_command(jsonb) owner to postgres;
alter function private.update_scheduled_challenge_command(jsonb) owner to postgres;
alter function private.run_calendar_tick_command(jsonb) owner to postgres;
alter function public.get_superadmin_calendar_context() owner to postgres;
alter function public.get_room_calendar(text) owner to postgres;
alter function public.create_superadmin_scheduled_challenge(jsonb) owner to postgres;
alter function public.update_superadmin_scheduled_challenge(jsonb) owner to postgres;

revoke all on function private.assert_supported_calendar_content(uuid),
  private.create_scheduled_challenge_command(jsonb), private.update_scheduled_challenge_command(jsonb),
  private.run_calendar_tick_command(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.get_superadmin_calendar_context(), public.get_room_calendar(text),
  public.create_superadmin_scheduled_challenge(jsonb), public.update_superadmin_scheduled_challenge(jsonb)
  from public, anon, service_role;
grant execute on function public.get_superadmin_calendar_context(), public.get_room_calendar(text),
  public.create_superadmin_scheduled_challenge(jsonb), public.update_superadmin_scheduled_challenge(jsonb)
  to authenticated;
