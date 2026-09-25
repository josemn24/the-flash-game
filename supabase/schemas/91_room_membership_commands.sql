-- Public room membership management. Only the active room owner may change
-- another member's role or status; all writes remain inside this command.
set local check_function_bodies = off;

create function private.manage_room_member_command(input jsonb) returns jsonb
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
    update public.room_memberships
    set status = 'removed', ended_at = clock_timestamp()
    where id = target_membership.id
    returning * into target_membership;
  end if;

  result := jsonb_build_object(
    'roomKey', room_slug_value,
    'targetPlayerId', target_membership.player_id,
    'action', action_value,
    'role', target_membership.role,
    'status', target_membership.status
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

create function public.manage_room_member(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.manage_room_member_command(input);
$$;

alter function private.manage_room_member_command(jsonb) owner to postgres;
alter function public.manage_room_member(jsonb) owner to postgres;
revoke all on function private.manage_room_member_command(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.manage_room_member(jsonb) from public, anon, service_role;
revoke execute on function public.manage_room_member(jsonb) from service_role;
grant execute on function public.manage_room_member(jsonb) to authenticated;

set local check_function_bodies = on;
