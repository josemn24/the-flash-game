-- S17 owner-only room membership management boundary. Disposable fixtures only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.manage_room_member(jsonb)', 'EXECUTE'),
  'Authenticated users can reach the membership command boundary');
select ok(not has_function_privilege('anon', 'public.manage_room_member(jsonb)', 'EXECUTE'),
  'Anonymous users cannot manage room members');
select ok(not has_function_privilege('service_role', 'public.manage_room_member(jsonb)', 'EXECUTE'),
  'Service role cannot bypass the application membership boundary');

select test_support.as_actor('owner');
set local role authenticated;
select is((public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-promote-member',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member'),
  'action', 'grant_admin'
))->>'role'), 'admin', 'Owner can promote an active member');
reset role;
select is((select role::text from public.room_memberships
  where room_id = test_support.id('room-flash') and player_id = test_support.id('member')), 'admin',
  'Promotion persists the admin role');
select is((select count(*) from private.audit_log
  where action = 'manage_room_member_grant_admin' and entity_id =
    (select id from public.room_memberships where room_id = test_support.id('room-flash')
      and player_id = test_support.id('member'))), 1::bigint,
  'Promotion writes one audit event');

set local role authenticated;
select is((public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-promote-member',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member'),
  'action', 'grant_admin'
))->>'role'), 'admin', 'Repeating the same command is idempotent');
select throws_ok($$select public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-promote-member',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member'),
  'action', 'revoke_admin'
))$$, '40001', 'idempotency_conflict', 'Reusing a key with changed input is rejected');
reset role;

select test_support.as_actor('member');
set local role authenticated;
select throws_ok($$select public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-member-cannot-manage',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member2'),
  'action', 'grant_admin'
))$$, '42501', 'not_authorized', 'A normal member cannot manage members');
reset role;

reset role;
update public.room_memberships
set role = 'admin'
where room_id = test_support.id('room-flash') and player_id = test_support.id('member2');
select test_support.as_actor('member2');
set local role authenticated;
select throws_ok($$select public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-admin-cannot-manage',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member'),
  'action', 'revoke_admin'
))$$, '42501', 'not_authorized', 'An admin cannot manage members in the first version');
reset role;

select test_support.as_actor('owner');
set local role authenticated;
select throws_ok($$select public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-owner-protected',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('owner'),
  'action', 'remove'
))$$, '42501', 'member_is_owner', 'The owner cannot be modified');
select throws_ok($$select public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-spectator-role',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('spectator'),
  'action', 'grant_admin'
))$$, '22023', 'invalid_member_role', 'A spectator cannot be promoted to admin');
select is((public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-remove-member2',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member2'),
  'action', 'remove'
))->>'status'), 'removed', 'Owner can logically remove a member');
reset role;
select is((select status::text from public.room_memberships
  where room_id = test_support.id('room-flash') and player_id = test_support.id('member2')), 'removed',
  'Removal keeps the membership row as historical data');
select ok((select ended_at is not null from public.room_memberships
  where room_id = test_support.id('room-flash') and player_id = test_support.id('member2')),
  'Removal records when the membership ended');

select * from finish();
rollback;
