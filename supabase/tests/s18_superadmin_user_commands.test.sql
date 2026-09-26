-- Superadmin account profile and room provisioning boundaries. Disposable fixtures only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

insert into auth.users(id, email) values
  (test_support.id('auth-created-user'), 'created@example.com'),
  (test_support.id('auth-created-admin'), 'created-admin@example.com'),
  (test_support.id('auth-created-spectator'), 'created-spectator@example.com');

select ok(has_function_privilege('authenticated', 'public.create_superadmin_player(jsonb)', 'EXECUTE'),
  'Authenticated sessions can reach the guarded player-provisioning RPC');
select ok(has_function_privilege('authenticated', 'public.add_superadmin_room_member(jsonb)', 'EXECUTE'),
  'Authenticated sessions can reach the guarded room-membership RPC');
select ok(not has_function_privilege('anon', 'public.create_superadmin_player(jsonb)', 'EXECUTE'),
  'Anonymous users cannot provision players');
select ok(not has_function_privilege('anon', 'public.add_superadmin_room_member(jsonb)', 'EXECUTE'),
  'Anonymous users cannot add room members');
select ok(not has_function_privilege('service_role', 'public.create_superadmin_player(jsonb)', 'EXECUTE'),
  'Service role cannot bypass the player-provisioning boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.create_superadmin_player(jsonb)'::regprocedure), 'postgres',
  'Player provisioning is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.add_superadmin_room_member(jsonb)'::regprocedure),
  'Membership command clears search_path');

select test_support.as_actor('superadmin');
set local role authenticated;
select is((public.create_superadmin_player(jsonb_build_object(
  'idempotencyKey', 's18-create-player-1',
  'authUserId', test_support.id('auth-created-user'),
  'displayName', 'Jugador nuevo',
  'reason', 'Alta para la beta'
))->>'displayName'), 'Jugador nuevo', 'Superadmin provisions a profile for an Auth user');
reset role;
select is((select count(*) from public.players
  where auth_user_id = test_support.id('auth-created-user') and status = 'active'), 1::bigint,
  'Creates exactly one active player profile');
select is((select count(*) from private.audit_log
  where action = 'create_superadmin_player' and entity_id =
    (select id from public.players where auth_user_id = test_support.id('auth-created-user'))), 1::bigint,
  'Profile creation is audited once');
select ok(not exists (select 1 from private.audit_log audit
  where audit.action = 'create_superadmin_player' and audit.after_payload::text like '%password%'),
  'Profile audit does not contain a password');

set local role authenticated;
select public.create_superadmin_player(jsonb_build_object(
  'idempotencyKey', 's18-create-player-1',
  'authUserId', test_support.id('auth-created-user'),
  'displayName', 'Jugador nuevo',
  'reason', 'Alta para la beta'
));
reset role;
select is((select count(*) from public.players
  where auth_user_id = test_support.id('auth-created-user')), 1::bigint,
  'Retrying profile provisioning does not create a duplicate');
select is((select count(*) from private.command_requests
  where actor_id = test_support.id('superadmin') and idempotency_key = 's18-create-player-1'), 1::bigint,
  'Retrying profile provisioning retains one command result');
set local role authenticated;
select throws_ok($$select public.create_superadmin_player(jsonb_build_object(
  'idempotencyKey', 's18-create-player-1', 'authUserId', test_support.id('auth-created-user'),
  'displayName', 'Otro nombre', 'reason', 'Cambio'
))$$, '40001', 'idempotency_conflict', 'Changed provisioning input conflicts on key reuse');
select throws_ok($$select public.create_superadmin_player(jsonb_build_object(
  'idempotencyKey', 's18-password-rejected', 'authUserId', test_support.id('auth-created-user'),
  'displayName', 'Jugador nuevo', 'reason', 'Alta', 'password', 'never-store-this'
))$$, '22023', 'invalid_command', 'The database boundary refuses password fields');
reset role;

insert into public.players(id, auth_user_id, display_name) values
  (test_support.id('created-admin-player'), test_support.id('auth-created-admin'), 'Jugador admin'),
  (test_support.id('created-spectator-player'), test_support.id('auth-created-spectator'), 'Jugador espectador');
select set_config('test.created_player_id',
  (select id::text from public.players where auth_user_id = test_support.id('auth-created-user')), true);
select test_support.as_actor('superadmin');
set local role authenticated;
select is((public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-add-new-member', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', current_setting('test.created_player_id')::uuid,
  'role', 'member', 'reason', 'Alta a sala'
))->>'role'), 'member', 'Superadmin adds a player as member');
reset role;
select is((select role::text from public.room_memberships
  where room_id = test_support.id('room-flash')
    and player_id = (select id from public.players where auth_user_id = test_support.id('auth-created-user'))),
  'member', 'Membership is persisted');

set local role authenticated;
select is((public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-add-created-admin', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('created-admin-player'), 'role', 'admin', 'reason', 'Alta a sala'
))->>'role'), 'admin', 'Superadmin can assign the admin role');
select is((public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-add-created-spectator', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('created-spectator-player'), 'role', 'spectator', 'reason', 'Alta a sala'
))->>'role'), 'spectator', 'Superadmin can assign the spectator role');
select throws_ok($$select public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-duplicate-active', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('created-admin-player'), 'role', 'member', 'reason', 'Duplicado'
))$$, '22023', 'member_already_active', 'An active duplicate membership is rejected');
select throws_ok($$select public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-owner-role', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('created-admin-player'), 'role', 'owner', 'reason', 'No owner'
))$$, '22023', 'invalid_member_role', 'Superadmin cannot assign the owner role');
reset role;

reset role;
update public.room_memberships set status = 'removed', ended_at = now() + interval '1 second'
where room_id = test_support.id('room-flash') and player_id = test_support.id('member2');
select test_support.as_actor('superadmin');
set local role authenticated;
select is((public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-reactivate-member', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('member2'), 'role', 'member', 'reason', 'Reincorporación'
))->>'reactivated'), 'true', 'A removed membership can be reactivated');
reset role;
select is((select status::text from public.room_memberships
  where room_id = test_support.id('room-flash') and player_id = test_support.id('member2')),
  'active', 'Reactivation restores active status');

reset role;
update public.room_memberships set status = 'banned', ended_at = now() + interval '2 seconds'
where room_id = test_support.id('room-flash') and player_id = test_support.id('member2');
select test_support.as_actor('superadmin');
set local role authenticated;
select throws_ok($$select public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-banned-member', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('member2'), 'role', 'member', 'reason', 'No reactivar'
))$$, '42501', 'member_banned', 'Banned memberships remain blocked');
reset role;

select test_support.as_actor('member');
set local role authenticated;
select throws_ok($$select public.add_superadmin_room_member(jsonb_build_object(
  'idempotencyKey', 's18-outsider-add', 'roomId', test_support.id('room-flash'),
  'targetPlayerId', test_support.id('member2'), 'role', 'member', 'reason', 'No autorizado'
))$$, '42501', 'not_authorized', 'Normal members cannot provision other members');
reset role;
set local role anon;
select throws_ok($$select public.create_superadmin_player('{}'::jsonb)$$, '42501', null,
  'Anonymous users cannot call profile provisioning');
select * from finish();
rollback;
