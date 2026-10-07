-- Shared identity, secret hashing and command idempotency lock helpers.
create function private.command_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.current_player_id();
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return actor;
end;
$$;

alter function private.command_actor() owner to postgres;
revoke all on function private.command_actor() from public, anon, authenticated, service_role;

create function private.secret_hash(secret text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if secret is null or length(secret) < 32 then raise exception 'invalid_token' using errcode = '22023'; end if;
  return encode(sha256(convert_to(secret, 'UTF8')), 'hex');
end;
$$;

alter function private.secret_hash(text) owner to postgres;
revoke all on function private.secret_hash(text) from public, anon, authenticated, service_role;

create function private.lock_command_key(target_actor uuid, target_key text) returns void
language sql volatile set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('flash-command:' || target_actor || ':' || target_key, 0))
$$;
alter function private.lock_command_key(uuid, text) owner to postgres;
revoke all on function private.lock_command_key(uuid, text) from public, anon, authenticated, service_role;
-- Shared authorization for replay paths. Command keys never grant gameplay access.
create function private.authorize_attempt_replay(target_attempt uuid, token_hash text) returns void
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
    select 1 from public.attempts a
    join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
    where a.id = target_attempt and a.player_id = private.current_player_id()
      and a.kind = 'competitive' and room.status = 'active' and sc.status <> 'cancelled'
      and m.status = 'active' and m.role in ('owner','admin','member')
      and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select s.revocation_reason into revoked_reason
  from private.attempt_sessions s
  where s.attempt_id = target_attempt and s.session_token_hash = token_hash
    and s.revoked_at is not null
  order by s.revoked_at desc
  limit 1;
  if revoked_reason = 'takeover' then
    raise exception 'session_transferred' using errcode = '42501';
  end if;
  if not exists (select 1 from private.attempt_sessions s
    where s.attempt_id = target_attempt and s.session_token_hash = token_hash and s.revoked_at is null)
  then raise exception 'session_revoked' using errcode = '42501'; end if;
end;
$$;
alter function private.authorize_attempt_replay(uuid, text) owner to postgres;
revoke all on function private.authorize_attempt_replay(uuid, text) from public, anon, authenticated, service_role;

create function private.raise_if_session_transferred(target_attempt uuid, token_hash text) returns void
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
revoke all on function private.raise_if_session_transferred(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.raise_if_session_transferred(uuid, text) to service_role;
