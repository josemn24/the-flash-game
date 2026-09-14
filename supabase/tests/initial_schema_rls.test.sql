-- Disposable test fixtures only: always rolled back, never application seed data.
-- Requires the declarative schema and pgTAP. Run in an isolated database.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('flash-schema-rls-test:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id)
select pg_temp.test_id('auth-' || name)
from unnest(array['owner', 'admin', 'member', 'spectator', 'outsider', 'superadmin']) name;
insert into public.players (id, auth_user_id, display_name)
select pg_temp.test_id(name), pg_temp.test_id('auth-' || name), name
from unnest(array['owner', 'admin', 'member', 'spectator', 'outsider', 'superadmin']) name;
insert into private.platform_role_assignments (player_id, role)
values (pg_temp.test_id('superadmin'), 'superadmin');
insert into public.rooms (id, slug, title) values
  (pg_temp.test_id('room-a'), 'rls-test-room-a', 'A'),
  (pg_temp.test_id('room-b'), 'rls-test-room-b', 'B');
insert into public.room_memberships (room_id, player_id, role)
select pg_temp.test_id('room-a'), pg_temp.test_id(name), name
from unnest(array['owner', 'admin', 'member', 'spectator']) name;
insert into public.room_memberships (room_id, player_id, role)
values (pg_temp.test_id('room-b'), pg_temp.test_id('outsider'), 'owner');
set constraints all immediate;
set constraints all deferred;

insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
select pg_temp.test_id('season-' || suffix), pg_temp.test_id('room-' || suffix), suffix,
  'active', now() - interval '2 days', now() + interval '2 days'
from unnest(array['a', 'b']) suffix;
insert into private.question_definitions (id, slug, created_by_player_id)
values (pg_temp.test_id('question'), 'rls-test-question', pg_temp.test_id('superadmin'));
insert into private.question_versions
  (id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
values (pg_temp.test_id('qv'), pg_temp.test_id('question'), 1, 'short-text', 60000, '{"prompt":"test"}', pg_temp.test_id('superadmin'));
insert into private.question_version_solutions (question_version_id, solution_payload)
values (pg_temp.test_id('qv'), '{"answer":"private"}');
update private.question_versions set status = 'published' where id = pg_temp.test_id('qv');
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (pg_temp.test_id('challenge'), 'rls-test-challenge', pg_temp.test_id('superadmin'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, mode, title, created_by_player_id)
select pg_temp.test_id('cv-' || n), pg_temp.test_id('challenge'), n, 'flash', 'test', pg_temp.test_id('superadmin')
from generate_series(1, 2) n;
insert into private.challenge_items (id, challenge_version_id, question_version_id, position, points)
select pg_temp.test_id('item-' || n), pg_temp.test_id('cv-' || n), pg_temp.test_id('qv'), 1, 100
from generate_series(1, 2) n;
update private.challenge_versions set status = 'published';
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select pg_temp.test_id('sc-' || suffix), pg_temp.test_id('season-' || suffix), pg_temp.test_id('cv-1'),
  1, 'open', now() - interval '1 day', now() + interval '1 day'
from unnest(array['a', 'b']) suffix;
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (
  pg_temp.test_id('season-draft'), pg_temp.test_id('room-a'), 'draft', 'draft',
  now() - interval '1 day', now() + interval '1 day'
);
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (
  pg_temp.test_id('sc-draft'), pg_temp.test_id('season-draft'), pg_temp.test_id('cv-1'),
  1, 'open', now() - interval '1 day', now() + interval '1 day'
);

select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r'), 'Every application table has RLS');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))),
  'anon has no table privileges');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'private' and c.relkind in ('r', 'v')
    and has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
  'authenticated has no private table/view privileges');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'INSERT,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
  'Clients cannot insert, delete, truncate, create FKs or triggers');

set local role anon;
select throws_ok('select * from public.rooms', '42501', null, 'anon cannot read rooms');
select throws_ok('select * from public.players', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from private.question_version_solutions', '42501', null, 'anon cannot read solutions');
select throws_ok($$select * from public.get_challenge_ranking(pg_temp.test_id('sc-a'))$$,
  '42501', null, 'anon cannot call rankings');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is(private.current_player_id(), pg_temp.test_id('owner'), 'Auth resolves a distinct domain player');
select is((select count(*) from public.rooms), 1::bigint, 'Owner sees only their room');
select is((select count(*) from public.room_memberships), 4::bigint, 'Membership RLS does not recurse or expose another room');
select is((select count(*) from public.scheduled_challenges), 1::bigint,
  'Owner sees only publications from their visible season');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-a')), 1::bigint,
  'Owner can read their room publication');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-b')), 0::bigint,
  'Owner cannot read another room publication');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-draft')), 0::bigint,
  'Draft-season publications are hidden from room members');
select is((select count(*) from public.players), 4::bigint, 'Social profiles are limited to active peers and self');
select throws_ok('select auth_user_id from public.players', '42501', null, 'Auth IDs are never social columns');
select throws_ok('select * from public.players', '42501', null, 'Wildcard cannot bypass column grants');
select lives_ok($$update public.players set display_name = 'owner-edited' where id = pg_temp.test_id('owner')$$,
  'Own visible name can be updated');
with changed as (update public.players set display_name = 'attacker'
  where id = pg_temp.test_id('member') returning id)
select is((select count(*) from changed), 0::bigint,
  'Peer profile update affects zero rows');
select throws_ok($$update public.players set auth_user_id = pg_temp.test_id('auth-outsider')$$,
  '42501', null, 'Client cannot reassign identity');
select throws_ok($$update public.players set avatar_path = 'another-player/private-avatar'$$,
  '42501', null, 'Avatar changes require the server Storage check');
select throws_ok($$update public.room_memberships set role = 'owner'$$, '42501', null, 'No client role escalation');
select throws_ok($$insert into private.platform_role_assignments values (pg_temp.test_id('member'), 'superadmin', now(), now())$$,
  '42501', null, 'No client platform role assignment');
select throws_ok($$insert into public.rooms (title, slug) values ('intrusion', 'intrusion')$$,
  '42501', null, 'Room creation must include authorized atomic ownership');
select throws_ok('select * from private.question_versions', '42501', null, 'Even public gameplay payloads require controlled delivery');
select throws_ok('select * from private.room_invitations', '42501', null, 'Owner cannot enumerate invitation hashes');
select throws_ok('select * from private.attempt_sessions', '42501', null, 'Session hashes cannot be read');
select throws_ok('select * from private.audit_log', '42501', null, 'Audit payloads are private');
select throws_ok('delete from public.rooms', '42501', null, 'Client cannot delete rooms');
select throws_ok('truncate public.rooms cascade', '42501', null, 'TRUNCATE is revoked separately from RLS');
reset role;

-- This test-only trigger builds historical receipts; the command tests have no such bypass.
create function pg_temp.fixture_receipt() returns trigger language plpgsql as $$
begin
  insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
    received_at, presented_at, effective_submitted_at, time_used_ms, timed_out)
  values(new.attempt_id, new.challenge_item_id, new.challenge_version_id, new.answer,
    coalesce(new.submitted_at, new.presented_at), new.presented_at,
    coalesce(new.submitted_at, new.presented_at), new.time_used_ms, false) returning id into new.receipt_id;
  return new;
end;
$$;
create trigger a_fixture_receipt before insert on private.attempt_answers
  for each row execute function pg_temp.fixture_receipt();

-- Historical structural fixtures run as the test owner; command ACLs are tested separately.
reset role;
select lives_ok($$insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('attempt-owner'), pg_temp.test_id('owner'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('cv-1'), 'competitive', now() + interval '1 hour', 1)$$, 'Server creates eligible official attempt');
select throws_ok($$insert into public.attempts
  (player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('owner'), pg_temp.test_id('sc-a'), pg_temp.test_id('cv-1'),
    'competitive', now() + interval '1 hour', 1)$$, '23505', null, 'Duplicate official attempt rejected');
select throws_ok($$insert into public.attempts
  (player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('spectator'), pg_temp.test_id('sc-a'), pg_temp.test_id('cv-1'),
    'competitive', now() + interval '1 hour', 1)$$, 'P0001', null, 'Spectators cannot compete even via mistaken backend insert');
select throws_ok($$insert into public.attempts
  (player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('outsider'), pg_temp.test_id('sc-a'), pg_temp.test_id('cv-1'),
    'competitive', now() + interval '1 hour', 1)$$, 'P0001', null, 'Outsiders cannot start attempts');
select throws_ok($$insert into public.attempts
  (player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('superadmin'), pg_temp.test_id('sc-a'), pg_temp.test_id('cv-1'),
    'competitive', now() + interval '1 hour', 1)$$, 'P0001', null, 'Superadmin cannot compete');
select lives_ok($$insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
  values (pg_temp.test_id('attempt-test'), pg_temp.test_id('superadmin'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('cv-1'), 'test', now() + interval '1 hour', 1)$$, 'Superadmin test attempt is allowed');
select throws_ok($$insert into private.attempt_answers
  (attempt_id, challenge_item_id, challenge_version_id, status, points, presented_at, time_used_ms, idempotency_key)
  values (pg_temp.test_id('attempt-owner'), pg_temp.test_id('item-2'), pg_temp.test_id('cv-1'),
    'correct', 100, statement_timestamp(), 0, 'wrong-version')$$, '23503', null,
  'Composite FK rejects an item from another version');
select lives_ok($$insert into private.attempt_answers
  (id, attempt_id, challenge_item_id, challenge_version_id, status, points, presented_at, submitted_at, time_used_ms, idempotency_key)
  values (pg_temp.test_id('answer-owner'), pg_temp.test_id('attempt-owner'), pg_temp.test_id('item-1'), pg_temp.test_id('cv-1'),
    'incorrect', 0, statement_timestamp(), statement_timestamp(), 0, 'answer-once')$$, 'Server records a final answer');
select throws_ok($$update private.attempt_answers set points = 100$$, 'P0001', null, 'Historical answers cannot be rewritten');
select throws_ok($$update public.attempts set score = 0, status = 'completed', completed_at = statement_timestamp()
  where id = pg_temp.test_id('attempt-owner')$$, 'P0001', null, 'Every attempt update must advance lock_version');
select lives_ok($$update public.attempts set score = 0, status = 'completed', completed_at = statement_timestamp(), lock_version = lock_version + 1
  where id = pg_temp.test_id('attempt-owner')$$, 'Completion with zero points is valid');
select lives_ok($$insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
  values (pg_temp.test_id('season-a'), pg_temp.test_id('owner'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('attempt-owner'), 'accreditation', 0, 'credit-owner')$$, 'Zero-point accreditation is recorded');
select throws_ok($$insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
  values (pg_temp.test_id('season-a'), pg_temp.test_id('superadmin'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('attempt-test'), 'accreditation', 0, 'credit-ghost')$$,
  'P0001', null, 'Ghost attempts cannot receive points');
select throws_ok($$update public.attempts set status = 'in_progress', score = null, completed_at = null, lock_version = lock_version + 1
  where id = pg_temp.test_id('attempt-owner')$$, 'P0001', null, 'Terminal attempts cannot resume');
reset role;

set local role authenticated;
select is((select count(id) from public.attempts), 1::bigint, 'Owner reads own competitive result only');
select throws_ok('select progress_payload from public.attempts', '42501', null, 'Checkpoint payload is not directly readable');
select throws_ok('update public.attempts set score = 100', '42501', null, 'Clients cannot award themselves points');
select throws_ok('select * from private.attempt_answers', '42501', null, 'Review requires server authorization even for own answers');
select is((select count(*) from public.get_challenge_ranking(pg_temp.test_id('sc-a'))), 1::bigint,
  'Challenge ranking includes zero-point completion and excludes ghost');
select is((select count(*) from public.get_season_ranking(pg_temp.test_id('season-a'))), 3::bigint,
  'Season shows active competitors with zero and excludes spectators');
select is((select count(*) from public.get_challenge_ranking(pg_temp.test_id('sc-b'))), 0::bigint,
  'Ranking cannot cross room boundary');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-spectator'))::text, true);
set local role authenticated;
select is((select count(*) from public.rooms), 1::bigint, 'Spectator reads room metadata');
select is((select count(*) from public.scheduled_challenges), 1::bigint,
  'Spectator reads publications from their room');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-b')), 0::bigint,
  'Spectator cannot read another room publication');
select is((select count(*) from public.get_challenge_ranking(pg_temp.test_id('sc-a'))), 1::bigint, 'Spectator reads ranking');
select is((select count(id) from public.attempts), 0::bigint, 'Spectator cannot read another player raw attempts');
select throws_ok('select * from private.challenge_items', '42501', null, 'Spectator cannot obtain gameplay');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-outsider'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from public.scheduled_challenges), 1::bigint,
  'Owner of another room sees only that room publications');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-a')), 0::bigint,
  'Unrelated member cannot read room A publications');
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-b')), 1::bigint,
  'Owner can read room B publications');
reset role;
update public.rooms
set status = 'deleted', deleted_at = statement_timestamp()
where id = pg_temp.test_id('room-b');
set local role authenticated;
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-b')), 0::bigint,
  'Deleted rooms do not expose their publications');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-superadmin'))::text, true);
set local role authenticated;
select is((select count(*) from public.rooms), 0::bigint, 'Superadmin browser has no unaudited global RLS bypass');
select throws_ok('select * from private.platform_role_assignments', '42501', null, 'Global role assignments remain private');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-outsider'),
  'user_metadata', jsonb_build_object('role', 'superadmin', 'player_id', pg_temp.test_id('owner')))::text, true);
set local role authenticated;
select is((select count(*) from public.rooms where id = pg_temp.test_id('room-a')), 0::bigint, 'User metadata cannot forge identity or role');
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-owner'), 'is_anonymous', true)::text, true);
set local role authenticated;
select is((select count(*) from public.rooms), 0::bigint, 'Auth anonymous users are denied despite authenticated SQL role');
reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select is((select count(*) from public.rooms), 0::bigint, 'Missing auth.uid denies access');
reset role;

-- Database constraints, independently of RLS.
select throws_ok($$update private.question_version_solutions set solution_payload = '{}'$$,
  'P0001', null, 'Published solutions are frozen even for SQL owner');
select throws_ok($$update private.challenge_items set points = 99$$,
  'P0001', null, 'Published items are frozen');
select throws_ok($$update private.question_versions set public_payload = '{}'$$,
  'P0001', null, 'Published public payload is frozen');
select throws_ok($$update private.attempt_answers set points = 100$$,
  'P0001', null, 'Append-only trigger also blocks table owner');
select throws_ok($$update private.flash_point_entries set amount = 100$$,
  'P0001', null, 'Ledger is append-only');
select throws_ok($$insert into public.scheduled_challenges
  (season_id, challenge_version_id, number, opens_at, closes_at)
  values (pg_temp.test_id('season-a'), pg_temp.test_id('cv-1'), 2, now(), now() + interval '1 hour')$$,
  '23P01', null, 'Overlapping publication windows are excluded');
select throws_ok($$update public.room_memberships set role = 'member' where player_id = pg_temp.test_id('owner');
  set constraints all immediate$$, 'P0001', null, 'Active room cannot be left without an owner');
select throws_ok($$insert into public.seasons (room_id, title, status, starts_at, ends_at)
  values (pg_temp.test_id('room-a'), 'duplicate', 'active', now(), now() + interval '1 day')$$,
  '23505', null, 'At most one active season');
select throws_ok($$update public.seasons set room_id = pg_temp.test_id('room-b')
  where id = pg_temp.test_id('season-a')$$, 'P0001', null, 'Seasons cannot move historical data to another room');
select lives_ok($$insert into public.scheduled_challenges
  (season_id, challenge_version_id, number, opens_at, closes_at)
  select season_id, challenge_version_id, 2, closes_at, closes_at + interval '1 hour'
  from public.scheduled_challenges where id = pg_temp.test_id('sc-a')$$,
  'Adjacent half-open publication windows are allowed');
select lives_ok($$insert into private.attempt_sessions (attempt_id, session_token_hash, expires_at)
  values (pg_temp.test_id('attempt-test'), 'hash-test-one', now() + interval '1 hour')$$,
  'First control session is allowed');
select throws_ok($$insert into private.attempt_sessions (attempt_id, session_token_hash, expires_at)
  values (pg_temp.test_id('attempt-test'), 'hash-test-two', now() + interval '1 hour')$$,
  '23505', null, 'Two unrevoked control sessions are rejected');
select throws_ok($$insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
  values (pg_temp.test_id('season-a'), pg_temp.test_id('owner'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('attempt-owner'), 'accreditation', 0, 'duplicate-credit')$$,
  'P0001', null, 'A second accreditation with a different key is still rejected');

-- Adjustments preserve originals and do not multiply the duration aggregate.
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, reason, created_by_player_id, idempotency_key)
values (pg_temp.test_id('season-a'), pg_temp.test_id('owner'), pg_temp.test_id('sc-a'),
  pg_temp.test_id('attempt-owner'), 'adjustment', 60, 'test correction', pg_temp.test_id('superadmin'), 'adjust-owner');
select throws_ok($$insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, reason, created_by_player_id, idempotency_key)
  values (pg_temp.test_id('season-a'), pg_temp.test_id('owner'), pg_temp.test_id('sc-a'),
    pg_temp.test_id('attempt-owner'), 'adjustment', 50, 'over-limit', pg_temp.test_id('superadmin'), 'bad-adjust')$$,
  'P0001', null, 'Effective ledger total cannot exceed 100');
select is((select score from public.attempts where id = pg_temp.test_id('attempt-owner')), 0,
  'Correction preserves the original attempt score');
insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, kind, deadline_at, client_state_schema_version)
values (pg_temp.test_id('attempt-admin'), pg_temp.test_id('admin'), pg_temp.test_id('sc-a'),
  pg_temp.test_id('cv-1'), 'competitive', now() + interval '1 hour', 1);
insert into private.attempt_answers
  (attempt_id, challenge_item_id, challenge_version_id, status, points, presented_at, time_used_ms, idempotency_key)
values (pg_temp.test_id('attempt-admin'), pg_temp.test_id('item-1'), pg_temp.test_id('cv-1'),
  'partial', 60, statement_timestamp(), 1000, 'answer-admin');
update public.attempts set status = 'completed', score = 60, completed_at = statement_timestamp(), lock_version = lock_version + 1
where id = pg_temp.test_id('attempt-admin');
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values (pg_temp.test_id('season-a'), pg_temp.test_id('admin'), pg_temp.test_id('sc-a'),
  pg_temp.test_id('attempt-admin'), 'accreditation', 60, 'credit-admin');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-admin'))::text, true);
set local role authenticated;
select is((select count(*) from public.rooms), 1::bigint, 'Admin reads their room');
select is((select count(*) from public.get_season_ranking(pg_temp.test_id('season-a')) where position = 1),
  2::bigint, 'Equal season points share first position regardless of duration');
select is((select position from public.get_season_ranking(pg_temp.test_id('season-a')) where player_id = pg_temp.test_id('member')),
  3::bigint, 'Competition ranking skips a position after a tie');
select is((select position from public.get_challenge_ranking(pg_temp.test_id('sc-a')) where player_id = pg_temp.test_id('admin')),
  2::bigint, 'Challenge ranking breaks equal points by effective duration');
reset role;
update public.attempts set status = 'invalidated', terminal_reason = 'test invalidation', lock_version = lock_version + 1
where id = pg_temp.test_id('attempt-admin');
set local role authenticated;
select is((select count(id) from public.attempts), 0::bigint, 'Own invalidated attempt requires administrative review');
select is((select count(*) from public.get_challenge_ranking(pg_temp.test_id('sc-a'))), 1::bigint,
  'Invalidation excludes old accreditation even before an audit reversal');
reset role;

-- A revoked membership takes effect without waiting for JWT refresh.
update public.room_memberships set status = 'banned', ended_at = statement_timestamp()
where player_id = pg_temp.test_id('member');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-member'))::text, true);
set local role authenticated;
select is((select count(*) from public.rooms), 0::bigint, 'Banned member immediately loses room access');
select is((select count(*) from public.get_season_ranking(pg_temp.test_id('season-a'))), 0::bigint, 'Banned member loses ranking access');
reset role;

update public.scheduled_challenges set status = 'cancelled', cancelled_at = statement_timestamp()
where id = pg_temp.test_id('sc-a');
select set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.test_id('auth-spectator'))::text, true);
set local role authenticated;
select is((select count(*) from public.scheduled_challenges where id = pg_temp.test_id('sc-a')), 1::bigint,
  'Cancelled publications remain visible as room metadata');
select is((select count(*) from public.get_challenge_ranking(pg_temp.test_id('sc-a'))), 0::bigint,
  'Cancelled publications have no competitive ranking');
reset role;

delete from auth.users where id = pg_temp.test_id('auth-owner');
select is((select display_name from public.players where id = pg_temp.test_id('owner')),
  'Participante anonimizado', 'Auth deletion anonymizes the social profile');
select is((select count(*) from public.attempts where player_id = pg_temp.test_id('owner')), 1::bigint,
  'Auth deletion preserves competitive history');
set constraints all immediate;
select * from finish();
rollback;
