-- S08 private-room command boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('s08-room:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id, email)
values
  (pg_temp.test_id('auth-superadmin'), 'operator@example.com'),
  (pg_temp.test_id('auth-owner'), 'owner@example.com'),
  (pg_temp.test_id('auth-admin'), 'admin@example.com'),
  (pg_temp.test_id('auth-member'), 'member@example.com'),
  (pg_temp.test_id('auth-spectator'), 'spectator@example.com'),
  (pg_temp.test_id('auth-outsider'), 'outsider@example.com');
insert into public.players (id, auth_user_id, display_name)
values
  (pg_temp.test_id('superadmin'), pg_temp.test_id('auth-superadmin'), 'Operador'),
  (pg_temp.test_id('owner'), pg_temp.test_id('auth-owner'), 'Owner'),
  (pg_temp.test_id('admin'), pg_temp.test_id('auth-admin'), 'Admin'),
  (pg_temp.test_id('member'), pg_temp.test_id('auth-member'), 'Member'),
  (pg_temp.test_id('spectator'), pg_temp.test_id('auth-spectator'), 'Spectator'),
  (pg_temp.test_id('outsider'), pg_temp.test_id('auth-outsider'), 'Outsider');
insert into private.platform_role_assignments (player_id, role)
values (pg_temp.test_id('superadmin'), 'superadmin');

select ok(has_function_privilege('authenticated', 'public.lookup_superadmin_players(text[])', 'EXECUTE'),
  'Authenticated can lookup superadmin player candidates');
select ok(has_function_privilege('authenticated', 'public.create_superadmin_room(jsonb)', 'EXECUTE'),
  'Authenticated can call the room creation boundary');
select ok(not has_function_privilege('anon', 'public.create_superadmin_room(jsonb)', 'EXECUTE'),
  'Anonymous users cannot call room creation');
select ok(not has_function_privilege('service_role', 'public.create_superadmin_room(jsonb)', 'EXECUTE'),
  'service_role cannot call the application room creation boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.create_superadmin_room(jsonb)'::regprocedure), 'postgres',
  'Room creation is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.create_superadmin_room(jsonb)'::regprocedure),
  'Room creation clears search_path');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.lookup_superadmin_players(
  array['OWNER@EXAMPLE.COM', 'admin@example.com'])), 2::bigint,
  'Superadmin lookup is exact and case insensitive');
select is((select display_name from public.lookup_superadmin_players(array['owner@example.com'])),
  'Owner', 'Lookup returns the active player name');
select is(public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-create-room-1',
  'title', 'Sala Beta',
  'description', 'Grupo de la beta',
  'timeZone', 'Europe/Madrid',
  'ownerEmail', 'owner@example.com',
  'initialMembers', jsonb_build_array(
    jsonb_build_object('email', 'admin@example.com', 'role', 'admin'),
    jsonb_build_object('email', 'member@example.com', 'role', 'member'),
    jsonb_build_object('email', 'spectator@example.com', 'role', 'spectator')
  ),
  'reason', 'Preparación de la beta'
))->>'slug', 'sala-beta', 'Creates a normalized generated slug');
reset role;
set local role postgres;
select is((select count(*) from public.rooms where slug = 'sala-beta'), 1::bigint,
  'Creates exactly one active room');
select is((select count(*) from public.room_memberships membership
  join public.rooms room on room.id = membership.room_id where room.slug = 'sala-beta'), 4::bigint,
  'Creates owner and all initial memberships atomically');
select is((select role from public.room_memberships membership join public.rooms room on room.id = membership.room_id
  where room.slug = 'sala-beta' and membership.player_id = pg_temp.test_id('owner')), 'owner',
  'The explicit owner receives the owner role');
select is((select count(*) from public.seasons season join public.rooms room on room.id = season.room_id
  where room.slug = 'sala-beta'), 0::bigint, 'Room creation does not create a season');
select is((select count(*) from private.room_invitations invitation join public.rooms room on room.id = invitation.room_id
  where room.slug = 'sala-beta'), 0::bigint, 'Direct provisioning does not create an invitation');
select is((select count(*) from private.audit_log where action = 'create_room'
  and entity_id = (select id from public.rooms where slug = 'sala-beta')), 1::bigint,
  'Creates one aggregate audit event');
select ok(not exists (
  select 1 from private.audit_log audit
  where audit.action = 'create_room' and audit.entity_id = (select id from public.rooms where slug = 'sala-beta')
    and audit.after_payload::text like '%@example.com%'
), 'Audit payload does not store emails');
reset role;
set local role authenticated;

select is(public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-create-room-1',
  'title', 'Sala Beta', 'description', 'Grupo de la beta', 'timeZone', 'Europe/Madrid',
  'ownerEmail', 'owner@example.com',
  'initialMembers', jsonb_build_array(
    jsonb_build_object('email', 'admin@example.com', 'role', 'admin'),
    jsonb_build_object('email', 'member@example.com', 'role', 'member'),
    jsonb_build_object('email', 'spectator@example.com', 'role', 'spectator')
  ), 'reason', 'Preparación de la beta'
))->>'slug', 'sala-beta',
  'Retrying the same key returns the original room');
select is(jsonb_array_length(public.get_superadmin_portal_context()->'rooms'), 1,
  'Idempotent retry does not duplicate the room');
select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-create-room-1', 'title', 'Otra sala', 'description', '',
  'timeZone', 'Europe/Madrid', 'ownerEmail', 'owner@example.com',
  'initialMembers', '[]'::jsonb, 'reason', 'Cambio'
))$$, '40001', null, 'A reused key with different input is rejected');

select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-invalid-member', 'title', 'Sala inválida', 'description', '',
  'timeZone', 'Europe/Madrid', 'ownerEmail', 'owner@example.com',
  'initialMembers', jsonb_build_array(jsonb_build_object('email', 'missing@example.com', 'role', 'member')),
  'reason', 'Rollback'
))$$, '22023', null, 'Missing members reject the whole command');
select is((select count(*) from public.rooms where slug = 'sala-invalida'), 0::bigint,
  'Invalid group leaves no orphan room');
select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-duplicate-member', 'title', 'Sala duplicada', 'description', '',
  'timeZone', 'Europe/Madrid', 'ownerEmail', 'owner@example.com',
  'initialMembers', jsonb_build_array(
    jsonb_build_object('email', 'member@example.com', 'role', 'member'),
    jsonb_build_object('email', 'MEMBER@example.com', 'role', 'admin')
  ), 'reason', 'Duplicado'
))$$, '22023', null, 'Duplicate initial emails are rejected');
select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-owner-member', 'title', 'Sala owner', 'description', '',
  'timeZone', 'Europe/Madrid', 'ownerEmail', 'owner@example.com',
  'initialMembers', jsonb_build_array(jsonb_build_object('email', 'owner@example.com', 'role', 'member')),
  'reason', 'Owner duplicado'
))$$, '22023', null, 'The owner cannot also be an initial member');
select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-invalid-timezone', 'title', 'Sala zona', 'description', '',
  'timeZone', 'Not/AZone', 'ownerEmail', 'owner@example.com',
  'initialMembers', '[]'::jsonb, 'reason', 'Zona inválida'
))$$, '22023', null, 'Unknown time zones are rejected');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-outsider'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.lookup_superadmin_players(array['owner@example.com'])$$, '42501', null,
  'A normal player cannot query the superadmin directory');
select throws_ok($$select public.create_superadmin_room(jsonb_build_object(
  'idempotencyKey', 's08-outsider', 'title', 'Intrusión', 'description', '',
  'timeZone', 'Europe/Madrid', 'ownerEmail', 'owner@example.com',
  'initialMembers', '[]'::jsonb, 'reason', 'Intrusión'
))$$, '42501', null, 'A normal player cannot create a room');
reset role;

set local role anon;
select throws_ok($$select public.create_superadmin_room('{}'::jsonb)$$, '42501', null,
  'Anonymous room creation is denied');
reset role;

select * from finish();
rollback;
