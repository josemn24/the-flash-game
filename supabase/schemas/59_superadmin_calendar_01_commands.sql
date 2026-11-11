-- S12 — Programación de publicaciones del calendario.
-- Las escrituras administrativas usan la tabla de publicaciones existente; no exponen DML al cliente.

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
  points_total integer;
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
  if version_mode not in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial') then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;

  select count(*)::integer,
    count(*) filter (
      where item.position between 1 and 20
        and item.points > 0
        and item.config_schema_version = 1
        and (version_mode = 'pyramid'
          and private.is_valid_pyramid_level_config(item.mode_config)
          or version_mode = 'narrative'
          and jsonb_typeof(item.mode_config) = 'object'
          and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version_mode = 'alphabet'
          and jsonb_typeof(item.mode_config->'letter') = 'string'
          or version_mode not in ('pyramid', 'narrative', 'alphabet') and item.mode_config = '{}'::jsonb)
        and private.is_supported_flash_question(question.id)
    )::integer,
    coalesce(sum(item.points), 0)::integer
  into item_count, compatible_item_count, points_total
  from private.challenge_items item
  left join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = version_id;

  select count(*)::integer into solution_count
  from private.challenge_items item
  join private.question_version_solutions solution
    on solution.question_version_id = item.question_version_id
  where item.challenge_version_id = version_id;

  if version_schema <> 1 or version_score <> 100
    or (version_mode = 'flash' and version_config <> '{}'::jsonb)
    or (version_mode = 'alphabet' and version_config <> '{}'::jsonb)
    or (version_mode = 'survival' and (
      (select count(*) from jsonb_object_keys(version_config)) <> 1
      or jsonb_typeof(version_config->'lives') is distinct from 'number'
      or (version_config->>'lives')::numeric <> trunc((version_config->>'lives')::numeric)
      or (version_config->>'lives')::integer not between 1 and item_count
    ))
    or (version_mode = 'narrative' and (
      jsonb_typeof(version_config) is distinct from 'object'
      or jsonb_typeof(version_config->'prologue') is distinct from 'object'
      or jsonb_typeof(version_config->'beats') is distinct from 'array'
    ))
    or (version_mode = 'pyramid' and (
      not private.is_valid_pyramid_config(version_config, array(
        select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
        where item.challenge_version_id = version_id))
      or item_count <> 7
      or (select count(distinct item.mode_config->>'levelId')
        from private.challenge_items item where item.challenge_version_id = version_id) <> 7
      or exists (select 1 from private.challenge_items item
        where item.challenge_version_id = version_id and item.position not between 1 and 7)
    ))
    or (version_mode <> 'pyramid' and item_count not between 2 and 20)
    or compatible_item_count <> item_count
    or solution_count <> item_count
    or points_total <> 100 then
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
  if season_row.status not in ('draft','active','scheduled') then
    raise exception 'season_not_active' using errcode = '55000';
  end if;
  if not exists (select 1 from public.rooms room where room.id = room_id_value and room.status = 'active') then
    raise exception 'room_not_found' using errcode = '22023';
  end if;

  now_value := clock_timestamp();
  if opens_at_value >= closes_at_value
    or season_row.starts_at > opens_at_value
    or closes_at_value > season_row.ends_at
    or (season_row.status <> 'draft' and closes_at_value <= now_value) then
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
  if schedule_row.updated_at <> expected_updated_at_value then raise exception 'schedule_conflict' using errcode='40001'; end if;
  now_value:=clock_timestamp();
  perform private.assert_publication_calendar_window(schedule_row,opens_at_value,closes_at_value,now_value);
  if (number_value,challenge_version_id_value) is distinct from (schedule_row.number,schedule_row.challenge_version_id)
    and not (private.publication_calendar_permissions(schedule_row,now_value)->>'canEditWindow')::boolean then
    raise exception 'opening_reached' using errcode='55000';
  end if;
  if season_row.status not in ('draft','active','scheduled') then raise exception 'season_finished' using errcode='55000'; end if;
  if not exists(select 1 from public.rooms where id=room_id_value and status='active') then raise exception 'room_not_found' using errcode='22023'; end if;
  if opens_at_value<season_row.starts_at or closes_at_value>season_row.ends_at then raise exception 'schedule_outside_season' using errcode='23514'; end if;
  if challenge_version_id_value<>schedule_row.challenge_version_id then perform private.assert_supported_calendar_content(challenge_version_id_value); end if;

  before_payload := jsonb_build_object(
    'status', schedule_row.status, 'number', schedule_row.number,
    'challengeVersionId', schedule_row.challenge_version_id,
    'opensAt', schedule_row.opens_at, 'closesAt', schedule_row.closes_at
  );
  begin
    update public.scheduled_challenges
    set challenge_version_id = challenge_version_id_value,
        number = number_value, opens_at = opens_at_value, closes_at = closes_at_value
    where id = schedule_id_value and (challenge_version_id,number,opens_at,closes_at) is distinct from (challenge_version_id_value,number_value,opens_at_value,closes_at_value);
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
  if before_payload=jsonb_build_object('status',schedule_row.status,'number',number_value,'challengeVersionId',challenge_version_id_value,'opensAt',opens_at_value,'closesAt',closes_at_value) then
    insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'update_scheduled_challenge',safe_input,result);
    return result;
  end if;
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


create function private.cancel_scheduled_challenge_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  schedule_id_value uuid;
  expected_updated_at_value timestamptz;
  reason_value text;
  now_value timestamptz;
  cancelled_at_value timestamptz;
  room_id_value uuid;
  season_id_value uuid;
  cached private.command_requests%rowtype;
  schedule_row public.scheduled_challenges%rowtype;
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
    or not input ?& array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    schedule_id_value := (input->>'scheduledChallengeId')::uuid;
    expected_updated_at_value := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'scheduledChallengeId', schedule_id_value,
    'expectedUpdatedAt', expected_updated_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'cancel_scheduled_challenge' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select schedule.season_id into season_id_value
  from public.scheduled_challenges schedule where schedule.id = schedule_id_value;
  if not found then raise exception 'schedule_not_found' using errcode = '22023'; end if;
  select season.room_id into room_id_value
  from public.seasons season where season.id = season_id_value;
  if not found then raise exception 'season_not_found' using errcode = '22023'; end if;
  perform 1 from public.rooms room where room.id = room_id_value for update;
  if not found then raise exception 'room_not_found' using errcode = '22023'; end if;
  perform 1 from public.seasons season where season.id = season_id_value for update;
  select schedule.* into schedule_row
  from public.scheduled_challenges schedule
  where schedule.id = schedule_id_value for update;

  if schedule_row.status in ('closed','cancelled') then raise exception 'schedule_not_cancellable' using errcode='55000'; end if;
  if (select status<>'draft' from public.seasons where id=season_id_value) and schedule_row.opens_at<=clock_timestamp() then raise exception 'schedule_already_open' using errcode='55000'; end if;
  if schedule_row.updated_at <> expected_updated_at_value then raise exception 'schedule_conflict' using errcode='40001'; end if;
  now_value:=clock_timestamp();
  if not coalesce((private.publication_calendar_permissions(schedule_row,now_value)->>'canEditWindow')::boolean,false) then
    raise exception 'schedule_not_cancellable' using errcode='55000';
  end if;

  before_payload := jsonb_build_object(
    'status', schedule_row.status,
    'number', schedule_row.number,
    'challengeVersionId', schedule_row.challenge_version_id,
    'opensAt', schedule_row.opens_at,
    'closesAt', schedule_row.closes_at
  );
  cancelled_at_value := statement_timestamp();
  update public.scheduled_challenges
  set status = 'cancelled', cancelled_at = cancelled_at_value
  where id = schedule_id_value;

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
  where schedule.id = schedule_id_value;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'cancel_scheduled_challenge', 'scheduled_challenge', schedule_id_value, reason_value, key,
    before_payload, jsonb_build_object(
      'status', 'cancelled',
      'number', schedule_row.number,
      'challengeVersionId', schedule_row.challenge_version_id,
      'opensAt', schedule_row.opens_at,
      'closesAt', schedule_row.closes_at,
      'cancelledAt', cancelled_at_value
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'cancel_scheduled_challenge', safe_input, result);
  return result;
end;
$$;


create function public.create_superadmin_scheduled_challenge(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_scheduled_challenge_command(input);
$$;


create function public.update_superadmin_scheduled_challenge(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.update_scheduled_challenge_command(input);
$$;


create function public.cancel_superadmin_scheduled_challenge(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.cancel_scheduled_challenge_command(input);
$$;

alter function private.assert_supported_calendar_content(uuid) owner to postgres;
alter function private.create_scheduled_challenge_command(jsonb) owner to postgres;
alter function private.update_scheduled_challenge_command(jsonb) owner to postgres;
alter function private.cancel_scheduled_challenge_command(jsonb) owner to postgres;
alter function public.create_superadmin_scheduled_challenge(jsonb) owner to postgres;
alter function public.update_superadmin_scheduled_challenge(jsonb) owner to postgres;
alter function public.cancel_superadmin_scheduled_challenge(jsonb) owner to postgres;
revoke all on function private.assert_supported_calendar_content(uuid),
  private.create_scheduled_challenge_command(jsonb), private.update_scheduled_challenge_command(jsonb),
  private.cancel_scheduled_challenge_command(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_superadmin_scheduled_challenge(jsonb),
  public.update_superadmin_scheduled_challenge(jsonb), public.cancel_superadmin_scheduled_challenge(jsonb)
  from public, anon, service_role;
grant execute on function public.create_superadmin_scheduled_challenge(jsonb),
  public.update_superadmin_scheduled_challenge(jsonb), public.cancel_superadmin_scheduled_challenge(jsonb)
  to authenticated;
