-- S08 administrative commands. The public wrappers are narrow Auth-backed
-- boundaries; all writes remain inside a SECURITY DEFINER command owned by postgres.
set local check_function_bodies = off;

create function private.room_slug_base(value text) returns text
language sql immutable set search_path = '' as $$
  select left(
    btrim(
      regexp_replace(
        regexp_replace(
          translate(lower(btrim(value)),
            'áàäâãéèëêíìïîóòöôõúùüûñç',
            'aaaaaeeeeiiiiooooouuuunc'),
          '[^a-z0-9]+', '-', 'g'
        ),
        '(^-+|-+$)', '', 'g'
      ),
      '-'
    ),
    64
  );
$$;

create function private.create_room_command(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  title_value text := btrim(input->>'title');
  description_value text := btrim(input->>'description');
  time_zone_value text := btrim(input->>'timeZone');
  owner_email_value text := lower(btrim(input->>'ownerEmail'));
  reason_value text := btrim(input->>'reason');
  member jsonb;
  normalized_members jsonb;
  normalized_member jsonb;
  normalized_email text;
  owner_id uuid;
  owner_name text;
  member_id uuid;
  member_name text;
  member_ids uuid[] := '{}'::uuid[];
  member_roles text[] := '{}'::text[];
  member_count integer := 0;
  member_index integer;
  audit_members jsonb := '[]'::jsonb;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  audit_payload jsonb;
  slug_base text;
  slug_value text;
  slug_suffix integer := 1;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','title','description','timeZone','ownerEmail','initialMembers','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','title','description','timeZone','ownerEmail','initialMembers','reason'])
    )
    or input->'idempotencyKey' = 'null'::jsonb
    or input->'title' = 'null'::jsonb
    or input->'description' = 'null'::jsonb
    or input->'timeZone' = 'null'::jsonb
    or input->'ownerEmail' = 'null'::jsonb
    or input->'initialMembers' = 'null'::jsonb
    or input->'reason' = 'null'::jsonb
    or jsonb_typeof(input->'initialMembers') is distinct from 'array' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  if key is null or char_length(key) < 8 or char_length(key) > 160 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(title_value) not between 3 and 80
    or char_length(description_value) > 280
    or char_length(reason_value) = 0 or char_length(reason_value) > 500
    or char_length(owner_email_value) = 0 or char_length(owner_email_value) > 320
    or position('@' in owner_email_value) < 2 then
    raise exception 'invalid_room' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = time_zone_value
  ) then
    raise exception 'invalid_room_timezone' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where jsonb_typeof(member_item) is distinct from 'object'
      or not member_item ?& array['email','role']
      or exists (select 1 from jsonb_object_keys(member_item) key_name
        where key_name <> all(array['email','role']))
      or member_item->'email' = 'null'::jsonb
      or member_item->'role' = 'null'::jsonb
  ) then
    raise exception 'invalid_member' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where member_item->>'role' not in ('admin','member','spectator')
  ) then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;
  if exists (
    select 1
    from (
      select lower(btrim(member_item->>'email')) as email, count(*) as uses
      from jsonb_array_elements(input->'initialMembers') member_item
      group by lower(btrim(member_item->>'email'))
    ) duplicates
    where duplicates.email = '' or duplicates.uses > 1
  ) then
    raise exception 'duplicate_member' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where lower(btrim(member_item->>'email')) = owner_email_value
  ) then
    raise exception 'owner_in_members' using errcode = '22023';
  end if;

  normalized_members := coalesce((
    select jsonb_agg(
      jsonb_build_object('email', lower(btrim(member_item->>'email')), 'role', member_item->>'role')
      order by ordinal
    )
    from jsonb_array_elements(input->'initialMembers') with ordinality members(member_item, ordinal)
  ), '[]'::jsonb);
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'title', title_value,
    'description', description_value,
    'timeZone', time_zone_value,
    'ownerEmail', owner_email_value,
    'initialMembers', normalized_members,
    'reason', reason_value
  );

  perform pg_advisory_xact_lock(hashtextextended('superadmin-room-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_room' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select p.id, p.display_name into owner_id, owner_name
  from auth.users auth_user
  join public.players p on p.auth_user_id = auth_user.id
  where lower(auth_user.email) = owner_email_value and p.status = 'active';
  if not found then
    raise exception 'owner_not_found' using errcode = '22023';
  end if;

  for member in select value from jsonb_array_elements(normalized_members) loop
    normalized_email := member->>'email';
    select p.id, p.display_name into member_id, member_name
    from auth.users auth_user
    join public.players p on p.auth_user_id = auth_user.id
    where lower(auth_user.email) = normalized_email and p.status = 'active';
    if not found then
      raise exception 'member_not_found' using errcode = '22023';
    end if;
    member_ids := array_append(member_ids, member_id);
    member_roles := array_append(member_roles, member->>'role');
    member_count := member_count + 1;
    audit_members := audit_members || jsonb_build_array(
      jsonb_build_object('playerId', member_id, 'role', member->>'role')
    );
  end loop;

  -- A single low-volume namespace lock makes generated slugs deterministic even
  -- when two operators submit the same title concurrently.
  perform pg_advisory_xact_lock(hashtextextended('room-slug-namespace', 0));
  slug_base := coalesce(nullif(private.room_slug_base(title_value), ''), 'sala');
  loop
    slug_value := case when slug_suffix = 1 then slug_base else left(slug_base, 64 - char_length(slug_suffix::text) - 1) || '-' || slug_suffix::text end;
    exit when not exists (select 1 from public.rooms room where room.slug = slug_value);
    slug_suffix := slug_suffix + 1;
  end loop;

  insert into public.rooms (slug, title, description, time_zone, status)
  values (slug_value, title_value, description_value, time_zone_value, 'active')
  returning id into member_id;

  insert into public.room_memberships (room_id, player_id, role)
  values (member_id, owner_id, 'owner');
  if member_count > 0 then
    for member_index in 1..array_length(member_ids, 1) loop
      insert into public.room_memberships (room_id, player_id, role)
      values (member_id, member_ids[member_index], member_roles[member_index]);
    end loop;
  end if;

  result := jsonb_build_object(
    'roomId', member_id,
    'slug', slug_value,
    'title', title_value,
    'timeZone', time_zone_value,
    'owner', jsonb_build_object('playerId', owner_id, 'displayName', owner_name),
    'memberCount', 1 + coalesce(array_length(member_ids, 1), 0)
  );
  audit_payload := jsonb_build_object(
    'roomId', member_id,
    'slug', slug_value,
    'title', title_value,
    'timeZone', time_zone_value,
    'ownerPlayerId', owner_id,
    'initialMembers', audit_members
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_room', 'room', member_id, reason_value, key, null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_room', safe_input, result);
  return result;
end;
$$;

create function public.lookup_superadmin_players(target_emails text[])
returns table (email text, player_id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.current_player_id();
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select lower(auth_user.email), p.id, p.display_name
  from unnest(coalesce(target_emails, '{}'::text[])) requested(email)
  join auth.users auth_user on lower(auth_user.email) = lower(btrim(requested.email))
  join public.players p on p.auth_user_id = auth_user.id
  where p.status = 'active'
  order by lower(auth_user.email), p.id;
end;
$$;

create function public.create_superadmin_room(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_room_command(input);
$$;

alter function private.room_slug_base(text) owner to postgres;
alter function private.create_room_command(jsonb) owner to postgres;
alter function public.lookup_superadmin_players(text[]) owner to postgres;
alter function public.create_superadmin_room(jsonb) owner to postgres;

revoke all on function private.room_slug_base(text), private.create_room_command(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.lookup_superadmin_players(text[]), public.create_superadmin_room(jsonb)
  from public, anon, service_role;
revoke execute on function public.lookup_superadmin_players(text[]), public.create_superadmin_room(jsonb)
  from service_role;
grant execute on function public.lookup_superadmin_players(text[]), public.create_superadmin_room(jsonb)
  to authenticated;

set local check_function_bodies = on;
