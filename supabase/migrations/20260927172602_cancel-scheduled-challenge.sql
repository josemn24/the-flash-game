SET local check_function_bodies = off;

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

  if schedule_row.status = 'open' then raise exception 'schedule_already_open' using errcode = '55000'; end if;
  if schedule_row.status <> 'scheduled' then
    raise exception 'schedule_not_cancellable' using errcode = '55000';
  end if;
  if schedule_row.updated_at <> expected_updated_at_value then
    raise exception 'schedule_conflict' using errcode = '40001';
  end if;
  now_value := clock_timestamp();
  if now_value >= schedule_row.opens_at then
    raise exception 'schedule_already_open' using errcode = '55000';
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

CREATE OR REPLACE FUNCTION public.cancel_superadmin_scheduled_challenge (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.cancel_scheduled_challenge_command(input);
$function$;

REVOKE ALL ON FUNCTION "public"."cancel_superadmin_scheduled_challenge"(jsonb) FROM PUBLIC, "anon", "service_role";

REVOKE ALL ON FUNCTION "private"."cancel_scheduled_challenge_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."cancel_scheduled_challenge_command"(jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."cancel_superadmin_scheduled_challenge"(jsonb) TO "authenticated", "postgres";
