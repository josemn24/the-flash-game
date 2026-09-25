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
