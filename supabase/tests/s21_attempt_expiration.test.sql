-- S21 automatic expiration of inactive competitive attempts.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('service_role', 'private.expire_stale_attempts(jsonb)', 'EXECUTE'),
  'Only the server service role can execute stale-attempt expiration');
select ok(not has_function_privilege('authenticated', 'private.expire_stale_attempts(jsonb)', 'EXECUTE'),
  'Authenticated clients cannot execute stale-attempt expiration');

-- The fixture schedule is open. Create an attempt while it is playable, then
-- close it and backdate activity to simulate a disconnected player.
insert into public.attempts(
  id, player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version,
  progress_payload, last_activity_at
) values (
  test_support.id('s21-closed-attempt'), test_support.id('member'), test_support.id('sc-flash'),
  test_support.id('cv-flash'), 'competitive', 1, '{"question":1}'::jsonb, now() - interval '16 minutes'
);
insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
values (
  test_support.id('s21-closed-attempt'), repeat('a', 64), null
);
update public.scheduled_challenges
set status = 'closed'
where id = test_support.id('sc-flash');

set local role service_role;

select is((private.expire_stale_attempts(jsonb_build_object(
  'runId', 's21-closed-run', 'attemptId', test_support.id('s21-closed-attempt')
))->>'abandonedAttempts')::integer, 1,
  'A stale attempt is abandoned after publication closure');
select is((select status from public.attempts where id = test_support.id('s21-closed-attempt')), 'abandoned',
  'Closed-publication attempt becomes abandoned');
select is((select score from public.attempts where id = test_support.id('s21-closed-attempt')), null::integer,
  'Automatic abandonment does not assign points');
select is((select terminal_reason from public.attempts where id = test_support.id('s21-closed-attempt')), 'inactivity_timeout',
  'Automatic abandonment records its terminal reason');
select is((select count(*) from private.attempt_sessions where attempt_id = test_support.id('s21-closed-attempt') and revoked_at is not null), 1::bigint,
  'Automatic abandonment revokes the controlling session');
select is((select count(*) from private.audit_log where entity_id = test_support.id('s21-closed-attempt') and action = 'expire_stale_attempt'), 1::bigint,
  'Automatic abandonment writes an audit event');
select is((private.expire_stale_attempts(jsonb_build_object(
  'runId', 's21-closed-run-repeat', 'attemptId', test_support.id('s21-closed-attempt')
))->>'abandonedAttempts')::integer, 0,
  'Repeated expiration is idempotent');

reset role;

-- A stale attempt in a still-open publication remains playable under the
-- selected permissive policy. A deadline-expired attempt is eligible even if
-- its publication status has not yet been closed by the daily tick.
insert into public.attempts(
  id, player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version,
  last_activity_at
) values (
  test_support.id('s21-open-attempt'), test_support.id('member2'), test_support.id('sc-fast'),
  test_support.id('cv-fast'), 'competitive', 1, now() - interval '16 minutes'
);
set local role service_role;
select is((private.expire_stale_attempts(jsonb_build_object(
  'runId', 's21-open-run', 'attemptId', test_support.id('s21-open-attempt')
))->>'abandonedAttempts')::integer, 0,
  'Inactivity alone does not abandon an attempt in an open publication');
select is((select status from public.attempts where id = test_support.id('s21-open-attempt')), 'in_progress',
  'Open-publication attempt remains in progress');

reset role;
insert into public.attempts(
  id, player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version,
  last_activity_at
) values (
  test_support.id('s21-deadline-attempt'), test_support.id('member'), test_support.id('sc-alphabet-fast'),
  test_support.id('cv-alphabet-fast'), 'competitive', 1, clock_timestamp() - interval '16 minutes'
);
set local role service_role;
select pg_sleep(1.1);
select is((private.expire_stale_attempts(jsonb_build_object(
  'runId', 's21-deadline-run', 'attemptId', test_support.id('s21-deadline-attempt')
))->>'abandonedAttempts')::integer, 1,
  'A deadline-expired competitive attempt is abandoned');

reset role;
insert into public.attempts(
  id, player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version,
  last_activity_at
) values (
  test_support.id('s21-test-attempt'), test_support.id('superadmin'), test_support.id('sc-fast'),
  test_support.id('cv-fast'), 'test', 1, now() - interval '16 minutes'
);
set local role service_role;
select is((private.expire_stale_attempts(jsonb_build_object(
  'runId', 's21-test-run', 'attemptId', test_support.id('s21-test-attempt')
))->>'abandonedAttempts')::integer, 0,
  'Test attempts are never automatically abandoned');
select is((select status from public.attempts where id = test_support.id('s21-test-attempt')), 'in_progress',
  'Test attempts remain in progress');

select * from finish();
rollback;
