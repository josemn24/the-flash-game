-- Superadmin-only account profile provisioning and room membership commands.
set local check_function_bodies = off;

create function private.create_superadmin_player_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text;
  target_auth_user_id uuid;
  display_name_value text;
  reason_value text;
  player_id uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','authUserId','displayName','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','authUserId','displayName','reason']))
    or jsonb_typeof(input->'idempotencyKey') is distinct from 'string'
    or jsonb_typeof(input->'authUserId') is distinct from 'string'
    or jsonb_typeof(input->'displayName') is distinct from 'string'
    or jsonb_typeof(input->'reason') is distinct from 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  display_name_value := btrim(input->>'displayName');
  reason_value := btrim(input->>'reason');
  if input->>'authUserId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_player' using errcode = '22023';
  end if;
  target_auth_user_id := (input->>'authUserId')::uuid;
  if char_length(key) not between 8 and 160
    or char_length(display_name_value) not between 2 and 24
    or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_player' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = target_auth_user_id) then
    raise exception 'player_not_found' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'authUserId', target_auth_user_id,
    'displayName', display_name_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-user-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_superadmin_player' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select player.id into player_id
  from public.players player
  where player.auth_user_id = target_auth_user_id and player.status = 'active'
  for update;
  if found then
    if (select player.display_name from public.players player where player.id = player_id)
      is distinct from display_name_value then
      raise exception 'invalid_player' using errcode = '22023';
    end if;
  else
    insert into public.players (auth_user_id, display_name)
    values (target_auth_user_id, display_name_value)
    returning id into player_id;
  end if;

  result := jsonb_build_object('playerId', player_id, 'displayName', display_name_value);
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'create_superadmin_player', 'player', player_id, reason_value, key, null,
    jsonb_build_object('playerId', player_id, 'displayName', display_name_value)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_superadmin_player', safe_input, result);
  return result;
end;
$$;

create function public.create_superadmin_player(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_superadmin_player_command(input);
$$;

create function private.add_superadmin_room_member_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text;
  target_room_id uuid;
  target_player_id uuid;
  role_value text;
  reason_value text;
  room_row public.rooms%rowtype;
  target_player public.players%rowtype;
  target_membership public.room_memberships%rowtype;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  before_payload jsonb;
  result jsonb;
  reactivated boolean := false;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomId','targetPlayerId','role','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomId','targetPlayerId','role','reason']))
    or jsonb_typeof(input->'idempotencyKey') is distinct from 'string'
    or jsonb_typeof(input->'roomId') is distinct from 'string'
    or jsonb_typeof(input->'targetPlayerId') is distinct from 'string'
    or jsonb_typeof(input->'role') is distinct from 'string'
    or jsonb_typeof(input->'reason') is distinct from 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  role_value := input->>'role';
  reason_value := btrim(input->>'reason');
  if input->>'roomId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or input->>'targetPlayerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  target_room_id := (input->>'roomId')::uuid;
  target_player_id := (input->>'targetPlayerId')::uuid;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if role_value not in ('admin','member','spectator') then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomId', target_room_id,
    'targetPlayerId', target_player_id,
    'role', role_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-room-member-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'add_superadmin_room_member' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into room_row from public.rooms room
  where room.id = target_room_id and room.status = 'active' for update;
  if not found then raise exception 'room_not_found' using errcode = '42501'; end if;
  select * into target_player from public.players player
  where player.id = target_player_id and player.status = 'active'
    and player.auth_user_id is not null for share;
  if not found then raise exception 'player_not_found' using errcode = '42501'; end if;

  select * into target_membership from public.room_memberships membership
  where membership.room_id = target_room_id and membership.player_id = target_player_id for update;
  if found then
    if target_membership.status = 'active' then
      raise exception 'member_already_active' using errcode = '22023';
    end if;
    if target_membership.status = 'banned' then
      raise exception 'member_banned' using errcode = '42501';
    end if;
    before_payload := jsonb_build_object(
      'playerId', target_player_id, 'role', target_membership.role,
      'status', target_membership.status, 'joinedAt', target_membership.joined_at
    );
    update public.room_memberships
    set role = role_value, status = 'active', joined_at = clock_timestamp(), ended_at = null
    where id = target_membership.id
    returning * into target_membership;
    reactivated := true;
  else
    insert into public.room_memberships (room_id, player_id, role)
    values (target_room_id, target_player_id, role_value)
    returning * into target_membership;
    before_payload := null;
  end if;

  result := jsonb_build_object(
    'roomId', target_room_id,
    'playerId', target_player_id,
    'role', role_value,
    'status', 'active',
    'reactivated', reactivated
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'add_superadmin_room_member', 'room_membership', target_membership.id, reason_value, key,
    before_payload,
    jsonb_build_object('roomId', target_room_id, 'playerId', target_player_id,
      'role', role_value, 'status', 'active', 'reactivated', reactivated)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'add_superadmin_room_member', safe_input, result);
  return result;
end;
$$;

create function public.add_superadmin_room_member(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.add_superadmin_room_member_command(input);
$$;

alter function private.create_superadmin_player_command(jsonb) owner to postgres;
alter function public.create_superadmin_player(jsonb) owner to postgres;
alter function private.add_superadmin_room_member_command(jsonb) owner to postgres;
alter function public.add_superadmin_room_member(jsonb) owner to postgres;

revoke all on function private.create_superadmin_player_command(jsonb),
  private.add_superadmin_room_member_command(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_superadmin_player(jsonb),
  public.add_superadmin_room_member(jsonb) from public, anon, service_role;
revoke execute on function public.create_superadmin_player(jsonb),
  public.add_superadmin_room_member(jsonb) from service_role;
grant execute on function public.create_superadmin_player(jsonb),
  public.add_superadmin_room_member(jsonb) to authenticated;

set local check_function_bodies = on;
