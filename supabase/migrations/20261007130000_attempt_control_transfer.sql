-- Explicit, idempotent transfer of the controller session to a second device.
-- The candidate token is supplied by the server-side HttpOnly preparation cookie;
-- it is hashed before it reaches any durable table.
begin;
set local check_function_bodies = off;

alter table private.attempt_sessions
  add column if not exists revocation_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.attempt_sessions'::regclass
      and conname = 'attempt_sessions_revocation_reason_check'
  ) then
    alter table private.attempt_sessions
      add constraint attempt_sessions_revocation_reason_check
      check (revocation_reason in ('takeover', 'terminal', 'permission_revoked'));
  end if;
end;
$$;

-- Rows closed by the permission-loss migration predate the reason column.
update private.attempt_sessions sessions
set revocation_reason = 'permission_revoked'
from public.attempts attempts
where sessions.attempt_id = attempts.id
  and sessions.revoked_at is not null
  and attempts.terminal_reason = 'permission_revoked'
  and sessions.revocation_reason is null;

create or replace function private.authorize_attempt_replay(target_attempt uuid, token_hash text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare revoked_reason text;
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
    select 1
    from public.attempts a
    join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
    where a.id = target_attempt and a.player_id = private.current_player_id()
      and a.kind = 'competitive' and room.status = 'active' and sc.status <> 'cancelled'
      and m.status = 'active' and m.role in ('owner','admin','member')
      and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select s.revocation_reason into revoked_reason
  from private.attempt_sessions s
  where s.attempt_id = target_attempt and s.session_token_hash = token_hash
    and s.revoked_at is not null
  order by s.revoked_at desc
  limit 1;
  if revoked_reason = 'takeover' then
    raise exception 'session_transferred' using errcode = '42501';
  end if;
  if not exists (
    select 1 from private.attempt_sessions s
    where s.attempt_id = target_attempt and s.session_token_hash = token_hash and s.revoked_at is null
  ) then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
end;
$$;
alter function private.authorize_attempt_replay(uuid, text) owner to postgres;
revoke all on function private.authorize_attempt_replay(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.raise_if_session_transferred(target_attempt uuid, token_hash text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from private.attempt_sessions s
    where s.attempt_id = target_attempt
      and s.session_token_hash = token_hash
      and s.revoked_at is not null
      and s.revocation_reason = 'takeover'
  ) then
    raise exception 'session_transferred' using errcode = '42501';
  end if;
end;
$$;
alter function private.raise_if_session_transferred(uuid, text) owner to postgres;
revoke all on function private.raise_if_session_transferred(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.raise_if_session_transferred(uuid, text) to service_role;

create or replace function private.read_attempt_context(target_attempt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  perform private.raise_if_session_transferred(target_attempt, private.secret_hash(session_token));
  select jsonb_build_object('challengeMode', version.mode, 'scheduledChallengeId', attempt.scheduled_challenge_id)
  into result
  from public.attempts attempt
  join private.attempt_sessions session on session.attempt_id = attempt.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  where attempt.id = target_attempt and attempt.player_id = actor and attempt.kind = 'competitive'
    and session.revoked_at is null and session.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$$;
alter function private.read_attempt_context(uuid, text) owner to postgres;
revoke all on function private.read_attempt_context(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.read_attempt_context(uuid, text) to service_role;

-- This wrapper owns the full command boundary for already deployed databases.
-- Declarative schema uses execute_command('takeover'), whose handler contains
-- the same state transition; keeping this function standalone makes the
-- migration safe even when the old handler is still installed.
create or replace function private.take_over_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  before_payload jsonb;
  result jsonb;
  instant timestamptz := clock_timestamp();
  expected bigint;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','scheduledChallengeId','lockVersion','newSessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','scheduledChallengeId','lockVersion','newSessionToken'
    ]))
  then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{newSessionToken}', to_jsonb(private.secret_hash(input->>'newSessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests
  where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'takeover' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if found and cached.result is not null then
    return cached.result;
  end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if a.scheduled_challenge_id <> (input->>'scheduledChallengeId')::uuid then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
  if not exists (
    select 1 from public.seasons season
    join public.rooms room on room.id = season.room_id
    join public.room_memberships membership on membership.room_id = room.id
    where season.id = sc.season_id and room.status = 'active'
      and membership.player_id = actor and membership.status = 'active'
      and membership.role in ('owner','admin','member')
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if a.status <> 'in_progress' then
    raise exception 'attempt_terminal' using errcode = '55000';
  end if;
  if sc.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = '55000';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if a.deadline_at is not null and instant >= a.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;

  before_payload := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version,
    'score', a.score, 'deadlineAt', a.deadline_at);
  update private.attempt_sessions
  set revoked_at = instant, revocation_reason = 'takeover'
  where attempt_id = a.id and revoked_at is null;
  update public.attempts
  set lock_version = lock_version + 1, last_activity_at = instant
  where id = a.id
  returning * into a;
  insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
    values(a.id, safe_input->>'newSessionToken', a.deadline_at)
    returning * into session_row;
  result := jsonb_build_object(
    'attemptId', a.id,
    'sessionId', session_row.id,
    'lockVersion', a.lock_version,
    'deadlineAt', a.deadline_at,
    'transferred', true
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload)
  values(actor, 'takeover_confirmed', 'attempt', a.id, null, key, before_payload, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'takeover', safe_input, result);
  return result;
end;
$$;
alter function private.take_over_attempt(jsonb) owner to postgres;
revoke all on function private.take_over_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.take_over_attempt(jsonb) to service_role;

commit;
