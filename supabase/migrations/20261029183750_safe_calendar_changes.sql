SET local check_function_bodies = off;

ALTER TABLE "public"."scheduled_challenges"
  DROP CONSTRAINT "scheduled_challenges_season_id_tstzrange_excl";

CREATE OR REPLACE FUNCTION private.assert_calendar_containment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare season_id_value uuid;
begin
  if tg_table_name='seasons' then season_id_value:=new.id; else season_id_value:=new.season_id; end if;
  if exists(select 1 from public.scheduled_challenges p join public.seasons s on s.id=p.season_id
    where s.id=season_id_value and p.status<>'cancelled' and (p.opens_at<s.starts_at or p.closes_at>s.ends_at)) then
    raise exception 'schedule_outside_season' using errcode='23514';
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.assert_publication_calendar_window (
  publication  public.scheduled_challenges,
  opens_value  timestamp with time zone,
  closes_value timestamp with time zone,
  instant      timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare permissions jsonb := private.publication_calendar_permissions(publication,instant); season_status text;
begin
  if opens_value is null or closes_value is null or not isfinite(opens_value) or not isfinite(closes_value) or opens_value >= closes_value then
    raise exception 'invalid_schedule_dates' using errcode='22007';
  end if;
  if (opens_value,closes_value) is not distinct from (publication.opens_at,publication.closes_at) then return; end if;
  if (permissions->>'canEditWindow')::boolean then
    select status into season_status from public.seasons where id=publication.season_id;
    if season_status <> 'draft' and opens_value <= instant then raise exception 'invalid_schedule_dates' using errcode='22007'; end if;
    return;
  end if;
  if (permissions->>'canExtendClose')::boolean and opens_value=publication.opens_at and closes_value>=publication.closes_at then return; end if;
  raise exception '%', coalesce(permissions->>'blockedReason','schedule_not_editable') using errcode='55000';
end $function$;

CREATE OR REPLACE FUNCTION private.assert_season_calendar_window (
  season       public.seasons,
  starts_value timestamp with time zone,
  ends_value   timestamp with time zone,
  instant      timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare permissions jsonb := private.season_calendar_permissions(season, instant);
begin
  if starts_value is null or ends_value is null or not isfinite(starts_value) or not isfinite(ends_value) or starts_value >= ends_value then
    raise exception 'invalid_season_dates' using errcode='22007';
  end if;
  if (starts_value,ends_value) is not distinct from (season.starts_at,season.ends_at) then return; end if;
  if not (permissions->>'canEditEnd')::boolean then raise exception 'season_finished' using errcode='55000'; end if;
  if starts_value <> season.starts_at and not (permissions->>'canEditStart')::boolean then
    raise exception 'season_start_locked' using errcode='55000';
  end if;
  if season.status <> 'draft' and ends_value <= instant then raise exception 'invalid_season_dates' using errcode='22007'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.cancel_scheduled_challenge_command (
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
$function$;

CREATE OR REPLACE FUNCTION private.create_scheduled_challenge_command (
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
$function$;

CREATE OR REPLACE FUNCTION private.guard_publication()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.season_id) is distinct from (old.id, old.season_id) then
      raise exception 'Publication identity and season are immutable';
    end if;
    perform private.assert_publication_calendar_window(old,new.opens_at,new.closes_at,clock_timestamp());
    if (new.number,new.challenge_version_id) is distinct from (old.number,old.challenge_version_id)
      and not coalesce((private.publication_calendar_permissions(old,clock_timestamp())->>'canEditWindow')::boolean,false) then
      raise exception 'opening_reached' using errcode='55000';
    end if;
    if old.status in ('closed', 'cancelled') and new.status not in (old.status, 'cancelled') then
      raise exception 'A terminal publication cannot reopen';
    end if;
    if old.status = 'open' and new.status not in ('open', 'closed', 'cancelled')
      and not coalesce((private.publication_calendar_permissions(old,clock_timestamp())->>'canEditWindow')::boolean,false) then
      raise exception 'An open publication cannot return to scheduled';
    end if;
  end if;
  if tg_op = 'INSERT' or new.challenge_version_id is distinct from old.challenge_version_id then
    perform 1 from private.challenge_versions where id = new.challenge_version_id and status = 'published' for share;
    if not found then raise exception 'A publication requires a published challenge version'; end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_season()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if (new.id, new.room_id) is distinct from (old.id, old.room_id) then
    raise exception 'Season identity and room are immutable';
  end if;
  if old.status in ('finished', 'cancelled') and new is distinct from old then
    raise exception 'Terminal seasons are immutable; corrections require a dedicated audited operation';
  end if;
  if old.status <> 'draft' and new.title is distinct from old.title then
    raise exception 'Only draft seasons may change their title';
  end if;
  perform private.assert_season_calendar_window(old,new.starts_at,new.ends_at,clock_timestamp());
  if old.status = 'active' and new.status not in ('active', 'finished', 'cancelled') then
    raise exception 'An active season cannot return to preparation';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_start (
  input         jsonb,
  safe_input    jsonb,
  actor         uuid,
  cached_result jsonb,
  is_admin      boolean
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  a public.attempts%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  target uuid;
  season_id_value uuid;
  room_id_value uuid;
  result jsonb;
  resumed boolean := false;
  control_required boolean := false;
begin
  target := (input->>'scheduledChallengeId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
  if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
  select p.season_id,s.room_id into season_id_value,room_id_value from public.scheduled_challenges p join public.seasons s on s.id=p.season_id where p.id=target;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  perform 1 from public.rooms where id=room_id_value for share;
  perform 1 from public.seasons where id=season_id_value for share;
  select * into sc from public.scheduled_challenges where id = target for share;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
    join public.room_memberships m on m.room_id = r.id
    where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
      and m.status = 'active' and m.role in ('owner','admin','member')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
  if cached_result is not null then
    perform private.authorize_attempt_replay(a.id, safe_input->>'sessionToken');
    return jsonb_build_object(
      'result', cached_result,
      'entityType', 'attempt',
      'entityId', a.id,
      'beforePayload', null,
      'replayed', true
    ); end if;
  if found then
    if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
    resumed := true;
    select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
    control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
  else
    insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
    values(actor, target, sc.challenge_version_id, 'competitive', 1)
    returning * into a;
    insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
      values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
  end if;
  target := a.id;
  result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
    'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version,
    'timeTrial', case when (select mode from private.challenge_versions where id = a.challenge_version_id) = 'time-trial' then private.time_trial_progress(a.id) end);
  return jsonb_build_object('result', result, 'entityType', 'attempt', 'entityId', a.id, 'beforePayload', null, 'replayed', false);
end;
$function$;

CREATE OR REPLACE FUNCTION private.preview_calendar_change (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  season public.seasons%rowtype; publication public.scheduled_challenges%rowtype;
  change jsonb; changes jsonb := '[]'; starts_value timestamptz; ends_value timestamptz;
  opens_value timestamptz; closes_value timestamptz; instant timestamptz := clock_timestamp();
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=private.current_player_id() and role='superadmin') then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object' or not input ?& array['seasonId','expectedUpdatedAt','startsAt','endsAt','publications']
    or jsonb_typeof(input->'publications') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(input) k where k<>all(array['seasonId','expectedUpdatedAt','startsAt','endsAt','publications'])) then
    raise exception 'invalid_command' using errcode='22023';
  end if;
  select s.* into season from public.seasons s join public.rooms r on r.id=s.room_id and r.status='active' where s.id=(input->>'seasonId')::uuid;
  if not found then raise exception 'season_not_found' using errcode='22023'; end if;
  if (input->>'expectedUpdatedAt')::timestamptz is distinct from season.updated_at then raise exception 'schedule_conflict' using errcode='40001'; end if;
  starts_value:=(input->>'startsAt')::timestamptz; ends_value:=(input->>'endsAt')::timestamptz;
  perform private.assert_season_calendar_window(season,starts_value,ends_value,instant);
  if exists(select 1 from jsonb_array_elements(input->'publications') c group by c->>'scheduledChallengeId' having count(*)>1) then
    raise exception 'invalid_command' using errcode='22023';
  end if;
  for change in select value from jsonb_array_elements(input->'publications') loop
    if jsonb_typeof(change) is distinct from 'object' or not change ?& array['scheduledChallengeId','expectedUpdatedAt','opensAt','closesAt']
      or exists(select 1 from jsonb_object_keys(change) k where k<>all(array['scheduledChallengeId','expectedUpdatedAt','opensAt','closesAt'])) then
      raise exception 'invalid_command' using errcode='22023';
    end if;
    select * into publication from public.scheduled_challenges where id=(change->>'scheduledChallengeId')::uuid and season_id=season.id;
    if not found then raise exception 'schedule_not_found' using errcode='22023'; end if;
    if (change->>'expectedUpdatedAt')::timestamptz is distinct from publication.updated_at then raise exception 'schedule_conflict' using errcode='40001'; end if;
    opens_value:=(change->>'opensAt')::timestamptz; closes_value:=(change->>'closesAt')::timestamptz;
    perform private.assert_publication_calendar_window(publication,opens_value,closes_value,instant);
    changes:=changes||jsonb_build_array(jsonb_build_object('scheduledChallengeId',publication.id,'number',publication.number,
      'before',jsonb_build_object('opensAt',publication.opens_at,'closesAt',publication.closes_at),
      'after',jsonb_build_object('opensAt',opens_value,'closesAt',closes_value)));
  end loop;
  if exists(
    select 1 from public.scheduled_challenges p left join jsonb_array_elements(input->'publications') c on (c->>'scheduledChallengeId')::uuid=p.id
    where p.season_id=season.id and p.status<>'cancelled' and
      (coalesce((c->>'opensAt')::timestamptz,p.opens_at)<starts_value or coalesce((c->>'closesAt')::timestamptz,p.closes_at)>ends_value)
  ) then raise exception 'schedule_outside_season' using errcode='23514'; end if;
  if exists(
    with windows as (
      select p.id,coalesce((c->>'opensAt')::timestamptz,p.opens_at) opens_at,coalesce((c->>'closesAt')::timestamptz,p.closes_at) closes_at
      from public.scheduled_challenges p left join jsonb_array_elements(input->'publications') c on (c->>'scheduledChallengeId')::uuid=p.id
      where p.season_id=season.id and p.status<>'cancelled'
    ) select 1 from windows a join windows b on a.id<b.id and tstzrange(a.opens_at,a.closes_at,'[)') && tstzrange(b.opens_at,b.closes_at,'[)')
  ) then raise exception 'schedule_overlap' using errcode='23P01'; end if;
  return jsonb_build_object('evaluatedAt',instant,'roomId',season.room_id,'seasonId',season.id,
    'season',jsonb_build_object('before',jsonb_build_object('startsAt',season.starts_at,'endsAt',season.ends_at),
      'after',jsonb_build_object('startsAt',starts_value,'endsAt',ends_value)), 'publications',changes);
end $function$;

CREATE OR REPLACE FUNCTION private.publication_calendar_permissions (
  publication public.scheduled_challenges,
  instant     timestamp with time zone
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'canEditWindow', p.status not in ('closed','cancelled') and (
      s.status = 'draft' or (s.status in ('active','scheduled') and s.ends_at > instant and p.opens_at > instant))
      and not exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.kind='competitive'),
    'canExtendClose', p.status not in ('closed','cancelled') and s.status in ('active','scheduled')
      and s.ends_at > instant and p.opens_at <= instant and p.closes_at > instant,
    'blockedReason', case
      when s.status in ('finished','cancelled') or (s.status <> 'draft' and s.ends_at <= instant) then 'season_finished'
      when p.status in ('closed','cancelled') or (s.status <> 'draft' and p.closes_at <= instant) then 'schedule_finished'
      when s.status <> 'draft' and p.opens_at <= instant then 'opening_reached'
      when exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.kind='competitive') then 'competitive_attempt_exists'
      else null end
  ) from public.scheduled_challenges p join public.seasons s on s.id=p.season_id where p.id=publication.id
$function$;

CREATE OR REPLACE FUNCTION private.season_calendar_permissions (
  season  public.seasons,
  instant timestamp with time zone
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'canEditStart', season.status = 'draft' or (
      season.status in ('active','scheduled') and season.ends_at > instant
      and not exists (select 1 from public.scheduled_challenges p
        where p.season_id = season.id and p.status <> 'cancelled' and p.opens_at <= instant)
      and not exists (select 1 from public.attempts a join public.scheduled_challenges p
        on p.id = a.scheduled_challenge_id where p.season_id = season.id and a.kind = 'competitive')),
    'canEditEnd', season.status = 'draft' or (season.status in ('active','scheduled') and season.ends_at > instant),
    'blockedReason', case
      when season.status in ('finished','cancelled') or (season.status <> 'draft' and season.ends_at <= instant)
        then 'season_finished'
      else null end
  )
$function$;

CREATE OR REPLACE FUNCTION private.track_calendar_measurement_dates()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.starts_at is distinct from old.starts_at then
    update private.room_measurement_participants person
      set history_from=greatest(new.starts_at,person.included_at,membership.joined_at)
      from private.room_measurements measurement,public.room_memberships membership
      where person.measurement_id=measurement.id and measurement.season_id=new.id
        and membership.room_id=new.room_id and membership.player_id=person.player_id;
    update private.room_measurement_publications publication
      set history_from=greatest(new.starts_at,publication.included_at)
      from private.room_measurements measurement
      where publication.measurement_id=measurement.id and measurement.season_id=new.id;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.update_scheduled_challenge_command (
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

CREATE OR REPLACE FUNCTION public.apply_superadmin_calendar_change (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid:=private.current_player_id(); key text:=btrim(input->>'idempotencyKey'); reason_value text:=btrim(input->>'reason');
  proposal jsonb:=input-'idempotencyKey'-'reason'; cached private.command_requests%rowtype;
  season public.seasons%rowtype; change jsonb; preview jsonb; changed boolean:=false;
begin
  if not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
  if key is null or char_length(key) not between 8 and 160 or reason_value is null or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:'||actor||':'||key,0));
  select * into cached from private.command_requests where actor_id=actor and idempotency_key=key;
  if found then
    if cached.operation<>'apply_calendar_change' or cached.input<>input then raise exception 'idempotency_conflict' using errcode='40001'; end if;
    return cached.result;
  end if;
  select * into season from public.seasons where id=(proposal->>'seasonId')::uuid;
  if not found then raise exception 'season_not_found' using errcode='22023'; end if;
  perform 1 from public.rooms where id=season.room_id for update;
  select * into season from public.seasons where id=season.id for update;
  perform 1 from public.scheduled_challenges where season_id=season.id order by id for update;
  preview:=private.preview_calendar_change(proposal);
  set constraints public.scheduled_challenges_season_id_tstzrange_excl,public.season_calendar_containment,public.publication_calendar_containment deferred;
  if (season.starts_at,season.ends_at) is distinct from ((proposal->>'startsAt')::timestamptz,(proposal->>'endsAt')::timestamptz) then
    update public.seasons set starts_at=(proposal->>'startsAt')::timestamptz,ends_at=(proposal->>'endsAt')::timestamptz where id=season.id;
    changed:=true;
  end if;
  for change in select value from jsonb_array_elements(proposal->'publications') loop
    update public.scheduled_challenges set opens_at=(change->>'opensAt')::timestamptz,closes_at=(change->>'closesAt')::timestamptz,
      status=case when status='open' and opens_at>clock_timestamp() then 'scheduled' else status end
    where id=(change->>'scheduledChallengeId')::uuid and (opens_at,closes_at) is distinct from ((change->>'opensAt')::timestamptz,(change->>'closesAt')::timestamptz);
    changed:=changed or found;
  end loop;
  set constraints public.scheduled_challenges_season_id_tstzrange_excl,public.season_calendar_containment,public.publication_calendar_containment immediate;
  preview:=preview||jsonb_build_object('changed',changed);
  if changed then
    insert into private.audit_log(actor_player_id,action,entity_type,entity_id,reason,request_id,before_payload,after_payload)
      values(actor,'apply_calendar_change','season',season.id,reason_value,key,preview-'changed',proposal);
  end if;
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result) values(actor,key,'apply_calendar_change',input,preview);
  return preview;
end $function$;

REVOKE ALL ON FUNCTION "public"."apply_superadmin_calendar_change"(jsonb) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_superadmin_calendar_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    'evaluatedAt', statement_timestamp(),
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
        'updatedAt', schedule.updated_at,
        'calendarPermissions', private.publication_calendar_permissions(schedule,statement_timestamp())
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.status = 'active' and version.status in ('published', 'archived') and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'metrics', jsonb_build_object(
      'activeRooms', (
        select count(*)
        from public.rooms room
        where room.status = 'active'
      ),
      'activeSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status = 'active'
      ),
      'pendingSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status in ('draft', 'scheduled')
      ),
      'editorialDrafts', (
        select count(*)
        from private.challenge_versions version
        where version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial') and version.status = 'draft'
      ),
      'upcomingChallenges', (
        select count(*)
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
      )
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasonCount', (
            select count(*)
            from public.seasons season_count
            where season_count.room_id = room.id
          ),
          'activeSeason', (
            select jsonb_build_object(
              'title', season.title,
              'startsAt', season.starts_at,
              'endsAt', season.ends_at,
                'updatedAt', season.updated_at,
                'evaluatedAt', statement_timestamp(),
                'calendarPermissions', private.season_calendar_permissions(season,statement_timestamp())
            )
            from public.seasons season
            where season.room_id = room.id and season.status = 'active'
            order by season.starts_at desc, season.id
            limit 1
          )
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb),
    'upcomingChallenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduledChallengeId', upcoming.scheduled_challenge_id,
          'roomId', upcoming.room_id,
          'roomTitle', upcoming.room_title,
          'seasonId', upcoming.season_id,
          'seasonTitle', upcoming.season_title,
          'challengeVersionId', upcoming.challenge_version_id,
          'challengeTitle', upcoming.challenge_title,
          'number', upcoming.challenge_number,
          'status', upcoming.challenge_status,
          'opensAt', upcoming.opens_at,
          'closesAt', upcoming.closes_at,
          'timeZone', upcoming.time_zone
        ) order by upcoming.opens_at, upcoming.scheduled_challenge_id
      )
      from (
        select
          schedule.id as scheduled_challenge_id,
          room.id as room_id,
          room.title as room_title,
          season.id as season_id,
          season.title as season_title,
          version.id as challenge_version_id,
          version.title as challenge_title,
          schedule.number as challenge_number,
          schedule.status as challenge_status,
          schedule.opens_at,
          schedule.closes_at,
          room.time_zone
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
        order by schedule.opens_at, schedule.id
        limit 5
      ) upcoming
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_portal_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasons', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'seasonId', season.id,
                'title', season.title,
                'status', season.status,
                'startsAt', season.starts_at,
                'endsAt', season.ends_at,
                'updatedAt', season.updated_at,
                'evaluatedAt', statement_timestamp(),
                'calendarPermissions', private.season_calendar_permissions(season,statement_timestamp())
              ) order by season.starts_at desc, season.id
            )
            from public.seasons season
            where season.room_id = room.id
          ), '[]'::jsonb),
          'status', room.status
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_calendar_context (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    'evaluatedAt', statement_timestamp(),
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
        'updatedAt', schedule.updated_at,
        'calendarPermissions', private.publication_calendar_permissions(schedule,statement_timestamp())
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status in ('published', 'archived')
        and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_detail (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  room_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'room', jsonb_build_object(
      'roomId', room.id,
      'slug', room.slug,
      'title', room.title,
      'timeZone', room.time_zone,
      'status', room.status,
      'seasons', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'seasonId', season.id,
            'title', season.title,
            'status', season.status,
            'startsAt', season.starts_at,
            'endsAt', season.ends_at,
                'updatedAt', season.updated_at,
                'evaluatedAt', statement_timestamp(),
                'calendarPermissions', private.season_calendar_permissions(season,statement_timestamp())
          ) order by season.starts_at desc, season.id
        )
        from public.seasons season
        where season.room_id = room.id
      ), '[]'::jsonb)
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'playerId', player.id,
          'displayName', player.display_name,
          'email', auth_user.email,
          'avatarPath', player.avatar_path,
          'role', membership.role,
          'joinedAt', membership.joined_at
        ) order by membership.joined_at, player.id
      )
      from public.room_memberships membership
      join public.players player on player.id = membership.player_id
      left join auth.users auth_user on auth_user.id = player.auth_user_id
      where membership.room_id = room.id
        and membership.status = 'active'
        and player.status = 'active'
    ), '[]'::jsonb)
  )
  into room_payload
  from public.rooms room
  where room.id = target_room_id and room.status = 'active';

  return room_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.preview_superadmin_calendar_change (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.preview_calendar_change(input); $function$;

REVOKE ALL ON FUNCTION "public"."preview_superadmin_calendar_change"(jsonb) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "public"."scheduled_challenges"
  ADD CONSTRAINT "scheduled_challenges_season_id_tstzrange_excl" EXCLUDE USING gist (season_id WITH =, tstzrange(opens_at, closes_at, '[)'::text) WITH &&)
    WHERE ((status <> 'cancelled'::text)) DEFERRABLE;

CREATE CONSTRAINT TRIGGER publication_calendar_containment
  AFTER INSERT OR UPDATE ON public.scheduled_challenges DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION private.assert_calendar_containment();

CREATE CONSTRAINT TRIGGER season_calendar_containment
  AFTER INSERT OR UPDATE ON public.seasons DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION private.assert_calendar_containment();

CREATE TRIGGER season_measurement_calendar_dates
  AFTER UPDATE OF starts_at ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION private.track_calendar_measurement_dates();

REVOKE ALL ON FUNCTION "private"."assert_calendar_containment"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_calendar_containment"() TO "postgres";

REVOKE ALL
  ON FUNCTION "private"."assert_publication_calendar_window"(public.scheduled_challenges, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "private"."assert_publication_calendar_window"(public.scheduled_challenges, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone)
  TO "postgres";

REVOKE ALL ON FUNCTION "private"."assert_season_calendar_window"(public.seasons, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_season_calendar_window"(public.seasons, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "private"."preview_calendar_change"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."preview_calendar_change"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."publication_calendar_permissions"(public.scheduled_challenges, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."publication_calendar_permissions"(public.scheduled_challenges, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "private"."season_calendar_permissions"(public.seasons, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."season_calendar_permissions"(public.seasons, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "private"."track_calendar_measurement_dates"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."track_calendar_measurement_dates"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."apply_superadmin_calendar_change"(jsonb) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."preview_superadmin_calendar_change"(jsonb) TO "authenticated", "postgres";
