-- S07: historical Flash projections and authorized terminal review.
begin;
set local search_path = public, extensions;
select no_plan();
set local session_replication_role = replica;

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('s07-flash-history:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id)
select pg_temp.test_id('auth-' || name)
from unnest(array['alice', 'bob', 'carol', 'dave', 'former']) name;
insert into public.players (id, auth_user_id, display_name)
select pg_temp.test_id(name), pg_temp.test_id('auth-' || name), initcap(name)
from unnest(array['alice', 'bob', 'carol', 'dave', 'former']) name;
insert into public.rooms (id, slug, title) values
  (pg_temp.test_id('room-main'), 's07-test-room', 'Sala histórica S07'),
  (pg_temp.test_id('room-other'), 's07-other-room', 'Sala externa S07');
insert into public.room_memberships (room_id, player_id, role, status, joined_at, ended_at)
values
  (pg_temp.test_id('room-main'), pg_temp.test_id('alice'), 'owner', 'active', now() - interval '20 days', null),
  (pg_temp.test_id('room-main'), pg_temp.test_id('bob'), 'spectator', 'active', now() - interval '20 days', null),
  (pg_temp.test_id('room-main'), pg_temp.test_id('carol'), 'member', 'active', now() - interval '20 days', null),
  (pg_temp.test_id('room-main'), pg_temp.test_id('dave'), 'member', 'active', now() - interval '20 days', null),
  (pg_temp.test_id('room-main'), pg_temp.test_id('former'), 'member', 'left', now() - interval '20 days', now() - interval '10 days'),
  (pg_temp.test_id('room-other'), pg_temp.test_id('alice'), 'owner', 'active', now() - interval '20 days', null);
insert into public.seasons (id, room_id, title, status, starts_at, ends_at) values
  (pg_temp.test_id('season-main'), pg_temp.test_id('room-main'), 'Temporada histórica', 'active',
    now() - interval '20 days', now() + interval '20 days'),
  (pg_temp.test_id('season-other'), pg_temp.test_id('room-other'), 'Otra temporada', 'active',
    now() - interval '20 days', now() + interval '20 days');
insert into private.question_definitions (id, slug, created_by_player_id) values
  (pg_temp.test_id('question-one'), 's07-question-one', pg_temp.test_id('alice')),
  (pg_temp.test_id('question-two'), 's07-question-two', pg_temp.test_id('alice'));
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms,
   public_payload, created_by_player_id, published_at)
values
  (pg_temp.test_id('question-version-one'), pg_temp.test_id('question-one'), 1, 1, 'archived',
    'multiple-choice', 15000, '{"category":"Cultura","tags":{"domains":["culture"],"topics":["general"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"prompt":"Pregunta uno","context":null,"timeLimitMs":15000,"payload":{"options":["A","B"],"media":null,"promptVisual":null}}', pg_temp.test_id('alice'), now() - interval '19 days'),
  (pg_temp.test_id('question-version-two'), pg_temp.test_id('question-two'), 1, 1, 'archived',
    'multiple-choice', 15000, '{"category":"Cultura","tags":{"domains":["culture"],"topics":["general"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"prompt":"Pregunta dos","context":null,"timeLimitMs":15000,"payload":{"options":["A","B"],"media":null,"promptVisual":null}}', pg_temp.test_id('alice'), now() - interval '19 days');
insert into private.question_version_solutions (question_version_id, solution_payload) values
  (pg_temp.test_id('question-version-one'), '{"solution":{"explanation":"S07 solution one","payload":{"correctAnswer":"A"}},"reveals":[]}'),
  (pg_temp.test_id('question-version-two'), '{"solution":{"explanation":"S07 solution two","payload":{"correctAnswer":"B"}},"reveals":[]}');
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (pg_temp.test_id('challenge'), 's07-history-challenge', pg_temp.test_id('alice'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, status, mode, title, subtitle, description,
   max_score, mode_config, created_by_player_id, published_at)
values (pg_temp.test_id('challenge-version'), pg_temp.test_id('challenge'), 1, 'archived', 'flash',
  'Flash histórico', 'Dos preguntas', 'Revisión histórica', 100, '{}', pg_temp.test_id('alice'), now() - interval '19 days');
insert into private.challenge_items (id, challenge_version_id, question_version_id, position, points)
values
  (pg_temp.test_id('item-one'), pg_temp.test_id('challenge-version'), pg_temp.test_id('question-version-one'), 1, 50),
  (pg_temp.test_id('item-two'), pg_temp.test_id('challenge-version'), pg_temp.test_id('question-version-two'), 2, 50);
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at, cancelled_at)
values
  (pg_temp.test_id('publication-completed'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 1, 'closed', now() - interval '9 days', now() - interval '8 days', null),
  (pg_temp.test_id('publication-empty'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 2, 'closed', now() - interval '7 days', now() - interval '6 days', null),
  (pg_temp.test_id('publication-in-progress'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 3, 'closed', now() - interval '5 days', now() - interval '4 days', null),
  (pg_temp.test_id('publication-cancelled'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 4, 'cancelled', now() - interval '3 days', now() - interval '2 days', now() - interval '3 days'),
  (pg_temp.test_id('publication-open'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 5, 'open', now() - interval '1 hour', now() + interval '1 day', null);

insert into public.attempts
  (id, player_id, scheduled_challenge_id, challenge_version_id, attempt_number, kind, status,
   started_at, completed_at, score, client_state_schema_version, lock_version)
values
  (pg_temp.test_id('attempt-alice'), pg_temp.test_id('alice'), pg_temp.test_id('publication-completed'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'completed', now() - interval '8 days 2 hours', now() - interval '8 days 1 hour', 100, 1, 1),
  (pg_temp.test_id('attempt-carol'), pg_temp.test_id('carol'), pg_temp.test_id('publication-completed'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'completed', now() - interval '8 days 2 hours', now() - interval '8 days 1 hour', 100, 1, 1),
  (pg_temp.test_id('attempt-dave'), pg_temp.test_id('dave'), pg_temp.test_id('publication-completed'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'completed', now() - interval '8 days 2 hours', now() - interval '8 days 1 hour', 50, 1, 1),
  (pg_temp.test_id('attempt-former'), pg_temp.test_id('former'), pg_temp.test_id('publication-completed'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'completed', now() - interval '8 days 2 hours', now() - interval '8 days 1 hour', 20, 1, 1),
  (pg_temp.test_id('attempt-abandoned'), pg_temp.test_id('carol'), pg_temp.test_id('publication-empty'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'abandoned', now() - interval '6 days 2 hours', now() - interval '6 days 1 hour', null, 1, 1),
  (pg_temp.test_id('attempt-in-progress'), pg_temp.test_id('alice'), pg_temp.test_id('publication-in-progress'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'in_progress', now() - interval '4 days 2 hours', null, null, 1, 1),
  (pg_temp.test_id('attempt-invalidated'), pg_temp.test_id('dave'), pg_temp.test_id('publication-empty'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'invalidated', now() - interval '6 days 2 hours', now() - interval '6 days 1 hour', null, 1, 1);
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values
  (pg_temp.test_id('season-main'), pg_temp.test_id('alice'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-alice'), 'accreditation', 100, 's07-ledger-alice'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('carol'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-carol'), 'accreditation', 100, 's07-ledger-carol'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('dave'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-dave'), 'accreditation', 50, 's07-ledger-dave'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('former'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-former'), 'accreditation', 20, 's07-ledger-former');
insert into private.answer_receipts
  (id, attempt_id, challenge_item_id, challenge_version_id, answer, received_at, presented_at,
   effective_submitted_at, time_used_ms, timed_out)
values
  (pg_temp.test_id('receipt-carol-one'), pg_temp.test_id('attempt-abandoned'), pg_temp.test_id('item-one'), pg_temp.test_id('challenge-version'), '"A"', now() - interval '6 days 2 hours', now() - interval '6 days 2 hours', now() - interval '6 days 2 hours', 500, false);
insert into private.attempt_answers
  (attempt_id, challenge_item_id, challenge_version_id, receipt_id, status, answer, result_details,
   points, presented_at, submitted_at, time_used_ms, idempotency_key)
values
  (pg_temp.test_id('attempt-abandoned'), pg_temp.test_id('item-one'), pg_temp.test_id('challenge-version'), pg_temp.test_id('receipt-carol-one'), 'incorrect', '"A"', '{}', 0, now() - interval '6 days 2 hours', now() - interval '6 days 2 hours', 500, 's07-answer-carol-one');
set local session_replication_role = origin;

select ok(has_function_privilege('authenticated', 'public.get_flash_history(text,uuid)', 'EXECUTE'),
  'Authenticated can query Flash history');
select ok(not has_function_privilege('anon', 'public.get_flash_history(text,uuid)', 'EXECUTE'),
  'Anonymous cannot query Flash history');
select ok(not has_function_privilege('service_role', 'public.get_flash_member_review(text,uuid,uuid)', 'EXECUTE'),
  'service_role cannot use the application review boundary');
select ok(position('public_payload' in pg_get_function_result(
  'public.get_flash_history(text,uuid)'::regprocedure)) = 0,
  'History metadata has no question payload');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(distinct publication_id) from public.get_flash_history('s07-test-room')), 2::bigint,
  'Alice sees only closed publications without in-progress attempts');
select is((select count(*) from public.get_flash_history('s07-test-room') where publication_id = pg_temp.test_id('publication-empty')), 1::bigint,
  'A closed publication without ranked results remains visible');
select is((select player_count from public.get_flash_history('s07-test-room') where publication_id = pg_temp.test_id('publication-empty')), 1::bigint,
  'Abandoned competitive attempts count as distinct participation');
select is((select string_agg(position::text, ',' order by position, player_id) from public.get_flash_history('s07-test-room') where publication_id = pg_temp.test_id('publication-completed')), '1,1,3,4',
  'Historical ranking applies points, duration and started_at ordering');
select is((select count(*) from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol'))), 2::bigint,
  'A member can review an abandoned attempt');
select is((select count(*) from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol')) where answer_status is null), 1::bigint,
  'Missing abandoned answers are returned as empty answer slots');
select ok(exists (select 1 from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol')) where solution_payload::text like '%S07 solution two%'),
  'Authorized review receives the immutable solution payload');
select is((select count(*) from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('alice'))), 0::bigint,
  'A player without a result has no review rows');
select is((select count(*) from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('dave'))), 0::bigint,
  'Invalidated attempts are absent from review');
select is((select count(*) from public.get_flash_history('s07-other-room')), 0::bigint,
  'A room member cannot cross into another room without history');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-bob'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(distinct publication_id) from public.get_flash_history('s07-test-room')), 2::bigint,
  'Spectator can read history metadata');
select is((select count(*) from public.get_flash_member_review('s07-test-room', pg_temp.test_id('publication-completed'), pg_temp.test_id('alice'))), 0::bigint,
  'Spectator cannot review another member');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_flash_history('s07-missing-room')), 0::bigint,
  'Unknown room has the same absence as an unauthorized scope');
select * from finish();
rollback;
