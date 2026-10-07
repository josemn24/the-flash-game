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

select test_support.as_actor('member2');
set local role service_role;
select private.start_attempt(jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-flash'),
  'sessionToken', repeat('m', 40),
  'idempotencyKey', 's17-member2-flash-start'
));
select private.start_attempt(jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-alphabet'),
  'sessionToken', repeat('n', 40),
  'idempotencyKey', 's17-member2-alphabet-start'
));
reset role;

select is((select count(*) from public.attempts
  where player_id = test_support.id('member2') and status = 'in_progress'), 2::bigint,
  'The member has active attempts in two different rooms before removal');

select test_support.as_actor('owner');
set local role authenticated;
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

select is((select status::text from public.attempts
  where player_id = test_support.id('member2')
    and scheduled_challenge_id = test_support.id('sc-flash')), 'abandoned',
  'Removing a member closes its competitive attempt in the affected room');
select is((select terminal_reason from public.attempts
  where player_id = test_support.id('member2')
    and scheduled_challenge_id = test_support.id('sc-flash')), 'permission_revoked',
  'Permission closure records its terminal reason');
select is((select status::text from public.attempts
  where player_id = test_support.id('member2')
    and scheduled_challenge_id = test_support.id('sc-alphabet')), 'in_progress',
  'Permission closure does not affect attempts in another room');
select is((select count(*) from private.attempt_sessions session
  join public.attempts attempt on attempt.id = session.attempt_id
  where attempt.player_id = test_support.id('member2')
    and attempt.scheduled_challenge_id = test_support.id('sc-flash')
    and session.revoked_at is not null), 1::bigint,
  'Permission closure revokes the affected controller session');
select is((select count(*) from private.flash_point_entries entry
  join public.attempts attempt on attempt.id = entry.attempt_id
  where attempt.player_id = test_support.id('member2')
    and attempt.scheduled_challenge_id = test_support.id('sc-flash')), 0::bigint,
  'Permission closure creates no point accreditation');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select is((private.read_abandoned_attempt((select id from public.attempts
  where player_id = test_support.id('member2')
    and scheduled_challenge_id = test_support.id('sc-flash')))->'result'->>'terminalReason'),
  'permission_revoked', 'The affected player can read the safe terminal result');
select is((private.read_abandoned_attempt((select id from public.attempts
  where player_id = test_support.id('member2')
    and scheduled_challenge_id = test_support.id('sc-flash')))->'result'->'answers'),
  '[]'::jsonb, 'Permission closure exposes no unaccepted answer payload');
select throws_ok($$select private.recover_attempt(jsonb_build_object(
  'idempotencyKey', 's17-revoked-recovery',
  'attemptId', (select id from public.attempts
    where player_id = test_support.id('member2')
      and scheduled_challenge_id = test_support.id('sc-flash')),
  'sessionToken', repeat('m', 40),
  'lockVersion', 2
))$$, '42501', 'attempt_permission_revoked',
  'A revoked attempt reports a specific permission error to the old client');
reset role;

select test_support.as_actor('owner');
set local role authenticated;
select is((public.manage_room_member(jsonb_build_object(
  'idempotencyKey', 's17-remove-member2',
  'roomKey', 'commands-flash',
  'targetPlayerId', test_support.id('member2'),
  'action', 'remove'
))->>'closedAttemptCount'), '1',
  'Repeating the removal replays the original closure without duplicating it');
reset role;

select * from finish();
rollback;
