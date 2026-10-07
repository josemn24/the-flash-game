-- Close competitive attempts atomically when a room membership loses gameplay access.
begin;
set local check_function_bodies = off;

create index if not exists attempts_active_player_idx
  on public.attempts (player_id, scheduled_challenge_id)
  where kind = 'competitive' and status = 'in_progress';

create or replace function private.authorize_attempt_replay(target_attempt uuid, token_hash text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.attempts a
    where a.id = target_attempt
      and a.player_id = private.current_player_id()
      and a.kind = 'competitive'
      and a.status = 'abandoned'
      and a.terminal_reason = 'permission_revoked'
  ) then
    raise exception 'attempt_permission_revoked' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.attempts a
    join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
    where a.id = target_attempt and a.player_id = private.current_player_id()
      and a.kind = 'competitive' and room.status = 'active' and sc.status <> 'cancelled'
      and m.status = 'active' and m.role in ('owner', 'admin', 'member')
      and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from private.attempt_sessions s
    where s.attempt_id = target_attempt
      and s.session_token_hash = token_hash
      and s.revoked_at is null
  ) then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
end;
$$;
alter function private.authorize_attempt_replay(uuid, text) owner to postgres;
revoke all on function private.authorize_attempt_replay(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.close_attempt_as_abandoned(
  target_attempt uuid,
  closed_at timestamptz,
  terminal_reason_value text,
  audit_actor uuid,
  audit_request_id text,
  audit_reason text
) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  attempt_row public.attempts%rowtype;
  before_payload jsonb;
begin
  if terminal_reason_value not in ('abandon', 'inactivity_timeout', 'permission_revoked')
    or closed_at is null
    or audit_request_id is null then
    raise exception 'invalid_attempt_closure' using errcode = '22023';
  end if;

  select * into attempt_row
  from public.attempts
  where id = target_attempt
  for update;

  if not found or attempt_row.kind <> 'competitive' or attempt_row.status <> 'in_progress' then
    return false;
  end if;

  before_payload := jsonb_build_object(
    'status', attempt_row.status,
    'lockVersion', attempt_row.lock_version,
    'score', attempt_row.score,
    'lastActivityAt', attempt_row.last_activity_at,
    'deadlineAt', attempt_row.deadline_at
  );

  update private.interaction_intervals interval_row
  set ended_at = greatest(interval_row.started_at, least(closed_at, timing_unit.deadline_at)),
      end_reason = 'abandon'
  from private.attempt_timing_units timing_unit
  where interval_row.attempt_id = attempt_row.id
    and interval_row.ended_at is null
    and timing_unit.id = interval_row.timing_unit_id;

  delete from private.prepared_interactions where attempt_id = attempt_row.id;

  update public.attempts
  set status = 'abandoned',
      score = null,
      outcome = null,
      completed_at = closed_at,
      progress_payload = null,
      terminal_reason = terminal_reason_value,
      lock_version = lock_version + 1
  where id = attempt_row.id and status = 'in_progress'
  returning * into attempt_row;

  if not found then return false; end if;

  update private.attempt_sessions
  set revoked_at = closed_at
  where attempt_id = attempt_row.id and revoked_at is null;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    audit_actor,
    case when terminal_reason_value = 'inactivity_timeout'
      then 'expire_stale_attempt'
      else 'close_attempt_' || terminal_reason_value
    end,
    'attempt', attempt_row.id,
    audit_reason, audit_request_id, before_payload,
    jsonb_build_object(
      'status', 'abandoned',
      'lockVersion', attempt_row.lock_version,
      'score', null,
      'completedAt', closed_at,
      'terminalReason', terminal_reason_value
    )
  );
  return true;
end;
$$;
alter function private.close_attempt_as_abandoned(uuid, timestamptz, text, uuid, text, text)
  owner to postgres;
revoke all on function private.close_attempt_as_abandoned(uuid, timestamptz, text, uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.close_attempts_for_permission_loss(
  target_player uuid,
  target_room uuid,
  closed_at timestamptz,
  audit_actor uuid,
  audit_request_id text
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  attempt_id uuid;
  closed_count integer := 0;
begin
  for attempt_id in
    select attempt.id
    from public.attempts attempt
    join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
    join public.seasons season on season.id = schedule.season_id
    where attempt.player_id = target_player
      and attempt.kind = 'competitive'
      and attempt.status = 'in_progress'
      and season.room_id = target_room
    order by attempt.id
    for update of attempt
  loop
    if private.close_attempt_as_abandoned(
      attempt_id,
      closed_at,
      'permission_revoked',
      audit_actor,
      audit_request_id || ':permission_revoked:' || attempt_id::text,
      'Competitive permission revoked for the room membership'
    ) then
      closed_count := closed_count + 1;
    end if;
  end loop;
  return closed_count;
end;
$$;
alter function private.close_attempts_for_permission_loss(uuid, uuid, timestamptz, uuid, text)
  owner to postgres;
revoke all on function private.close_attempts_for_permission_loss(uuid, uuid, timestamptz, uuid, text)
  from public, anon, authenticated, service_role;

-- Reconcile rows created before this migration. The closure is idempotent, so a
-- retry after an interrupted deployment cannot create a second transition or audit row.
do $$
declare
  membership_row record;
begin
  for membership_row in
    select membership.room_id, membership.player_id
    from public.room_memberships membership
    where membership.status in ('removed', 'banned')
      and exists (
        select 1
        from public.attempts attempt
        join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
        join public.seasons season on season.id = schedule.season_id
        where attempt.player_id = membership.player_id
          and season.room_id = membership.room_id
          and attempt.kind = 'competitive'
          and attempt.status = 'in_progress'
      )
    order by membership.room_id, membership.player_id
  loop
    perform 1 from public.rooms room where room.id = membership_row.room_id for update;
    perform 1 from public.room_memberships membership
      where membership.room_id = membership_row.room_id
        and membership.player_id = membership_row.player_id
      for update;
    perform private.close_attempts_for_permission_loss(
      membership_row.player_id,
      membership_row.room_id,
      clock_timestamp(),
      null,
      'migration:permission-revoked:' || membership_row.room_id::text || ':' || membership_row.player_id::text
    );
  end loop;
end;
$$;

create or replace function private.manage_room_member_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text;
  room_slug_value text;
  target_player_id uuid;
  action_value text;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  room_row public.rooms%rowtype;
  actor_membership public.room_memberships%rowtype;
  target_membership public.room_memberships%rowtype;
  before_payload jsonb;
  after_payload jsonb;
  result jsonb;
  closed_at timestamptz;
  closed_attempts integer := 0;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomKey','targetPlayerId','action']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomKey','targetPlayerId','action'])
    )
    or input->'idempotencyKey' = 'null'::jsonb
    or input->'roomKey' = 'null'::jsonb
    or input->'targetPlayerId' = 'null'::jsonb
    or input->'action' = 'null'::jsonb
    or jsonb_typeof(input->'idempotencyKey') <> 'string'
    or jsonb_typeof(input->'roomKey') <> 'string'
    or jsonb_typeof(input->'targetPlayerId') <> 'string'
    or jsonb_typeof(input->'action') <> 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  room_slug_value := btrim(input->>'roomKey');
  action_value := input->>'action';
  if char_length(key) < 8 or char_length(key) > 160 or room_slug_value = '' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if action_value not in ('grant_admin', 'revoke_admin', 'remove') then
    raise exception 'invalid_member_action' using errcode = '22023';
  end if;
  if input->>'targetPlayerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  target_player_id := (input->>'targetPlayerId')::uuid;
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomKey', room_slug_value,
    'targetPlayerId', target_player_id,
    'action', action_value
  );

  perform pg_advisory_xact_lock(hashtextextended('room-membership-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'manage_room_member' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into room_row
  from public.rooms room
  where room.slug = room_slug_value and room.status = 'active'
  for update;
  if not found then raise exception 'room_not_found' using errcode = '42501'; end if;

  select * into actor_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = actor
    and membership.status = 'active'
  for update;
  if not found or actor_membership.role <> 'owner' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into target_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = target_player_id
    and membership.status = 'active'
  for update;
  if not found then raise exception 'member_not_found' using errcode = '42501'; end if;
  if target_membership.role = 'owner' or target_membership.player_id = actor then
    raise exception 'member_is_owner' using errcode = '42501';
  end if;
  if action_value in ('grant_admin', 'revoke_admin') and target_membership.role = 'spectator' then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;

  before_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  if action_value = 'grant_admin' then
    update public.room_memberships
    set role = 'admin'
    where id = target_membership.id
    returning * into target_membership;
  elsif action_value = 'revoke_admin' then
    update public.room_memberships
    set role = 'member'
    where id = target_membership.id
    returning * into target_membership;
  else
    closed_at := clock_timestamp();
    update public.room_memberships
    set status = 'removed', ended_at = closed_at
    where id = target_membership.id
    returning * into target_membership;
    closed_attempts := private.close_attempts_for_permission_loss(
      target_player_id, room_row.id, closed_at, actor, key
    );
  end if;

  result := jsonb_build_object(
    'roomKey', room_slug_value,
    'targetPlayerId', target_membership.player_id,
    'action', action_value,
    'role', target_membership.role,
    'status', target_membership.status,
    'closedAttemptCount', closed_attempts
  );
  after_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'manage_room_member_' || action_value, 'room_membership', target_membership.id,
    null, key, before_payload, after_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'manage_room_member', safe_input, result);
  return result;
end;
$$;
alter function private.manage_room_member_command(jsonb) owner to postgres;
revoke all on function private.manage_room_member_command(jsonb) from public, anon, authenticated, service_role;

create or replace function public.manage_room_member(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.manage_room_member_command(input);
$$;
alter function public.manage_room_member(jsonb) owner to postgres;
revoke all on function public.manage_room_member(jsonb) from public, anon, service_role;
revoke execute on function public.manage_room_member(jsonb) from service_role;
grant execute on function public.manage_room_member(jsonb) to authenticated;

create or replace function private.read_abandoned_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'scheduledChallengeId', a.scheduled_challenge_id,
    'result', coalesce(command.result, jsonb_strip_nulls(jsonb_build_object(
      'attemptId', a.id,
      'lockVersion', a.lock_version,
      'status', a.status,
      'score', a.score,
      'outcome', a.outcome,
      'terminalReason', a.terminal_reason,
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'challengeItemId', answer.challenge_item_id,
          'answer', answer.answer,
          'status', answer.status,
          'points', answer.points,
          'timeUsedMs', answer.time_used_ms,
          'resultDetails', answer.result_details
        ) order by item.position)
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id
      ), '[]'::jsonb)
    )))
  )
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  left join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  left join private.command_requests command on command.actor_id = a.player_id
    and command.operation = 'abandon' and command.input->>'attemptId' = a.id::text
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'abandoned'
    and sc.status <> 'cancelled' and room.status = 'active'
    and (
      (a.terminal_reason = 'permission_revoked')
      or (
        command.result->>'status' = 'abandoned'
        and m.status = 'active' and m.role in ('owner','admin','member')
      )
    )
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;
alter function private.read_abandoned_attempt(uuid) owner to postgres;
revoke all on function private.read_abandoned_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function private.read_abandoned_attempt(uuid) to service_role;

commit;
