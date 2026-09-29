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
  (pg_temp.test_id('season-finished'), pg_temp.test_id('room-main'), 'Temporada cerrada', 'finished',
    now() - interval '40 days', now() - interval '20 days'),
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
insert into private.question_definitions (id, slug, created_by_player_id)
select pg_temp.test_id('question-' || n::text), 's07-question-' || n::text, pg_temp.test_id('alice')
from generate_series(3, 7) n;
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms,
   public_payload, created_by_player_id, published_at)
select pg_temp.test_id('question-version-' || n::text), pg_temp.test_id('question-' || n::text), 1, 1,
  'archived', 'multiple-choice', 15000,
  '{"category":"Cultura","tags":{"domains":["culture"],"topics":["general"],"cognitiveSkills":["memory"],"formatSkills":["recall"],"lifeSkills":[]},"prompt":"Pregunta adicional","context":null,"timeLimitMs":15000,"payload":{"options":["A","B"],"media":null,"promptVisual":null}}',
  pg_temp.test_id('alice'), now() - interval '19 days'
from generate_series(3, 7) n;
insert into private.question_version_solutions (question_version_id, solution_payload)
select pg_temp.test_id('question-version-' || n::text),
  jsonb_build_object('solution', jsonb_build_object('explanation', 'S07 solution ' || n::text,
    'payload', jsonb_build_object('correctAnswer', 'A')), 'reveals', '[]'::jsonb)
from generate_series(3, 7) n;
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
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points)
values
  (pg_temp.test_id('survival-item-one'), pg_temp.test_id('survival-challenge-version'), pg_temp.test_id('question-version-one'), 1, 50),
  (pg_temp.test_id('survival-item-two'), pg_temp.test_id('survival-challenge-version'), pg_temp.test_id('question-version-two'), 2, 50),
  (pg_temp.test_id('pyramid-item-one'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-one'), 1, 15),
  (pg_temp.test_id('pyramid-item-two'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-two'), 2, 15),
  (pg_temp.test_id('pyramid-item-three'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-3'), 3, 15),
  (pg_temp.test_id('pyramid-item-four'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-4'), 4, 15),
  (pg_temp.test_id('pyramid-item-five'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-5'), 5, 15),
  (pg_temp.test_id('pyramid-item-six'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-6'), 6, 15),
  (pg_temp.test_id('pyramid-item-seven'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('question-version-7'), 7, 10);
update private.challenge_items
set mode_config = jsonb_build_object(
  'levelId', 'level-' || position::text,
  'label', 'Nivel ' || position::text,
  'briefing', jsonb_build_object(
    'title', 'Briefing ' || position::text,
    'format', 'Formato',
    'description', 'Descripción del nivel ' || position::text
  )
)
where challenge_version_id = pg_temp.test_id('pyramid-challenge-version');
insert into private.challenge_definitions (id, slug, created_by_player_id)
values
  (pg_temp.test_id('survival-challenge'), 's07-survival-history', pg_temp.test_id('alice')),
  (pg_temp.test_id('pyramid-challenge'), 's07-pyramid-history', pg_temp.test_id('alice'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, status, mode, title, subtitle, description,
   max_score, mode_config, created_by_player_id, published_at)
values
  (pg_temp.test_id('survival-challenge-version'), pg_temp.test_id('survival-challenge'), 1, 'archived', 'survival',
    'Supervivencia histórica', 'Sin revisión', 'Ranking de supervivencia', 100, '{"lives":2}', pg_temp.test_id('alice'), now() - interval '18 days'),
  (pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('pyramid-challenge'), 1, 'archived', 'pyramid',
    'Pirámide histórica', 'Sin revisión', 'Ranking de pirámide', 100, '{}', pg_temp.test_id('alice'), now() - interval '17 days');
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at, cancelled_at)
values
  (pg_temp.test_id('publication-completed'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 1, 'closed', now() - interval '9 days', now() - interval '8 days', null),
  (pg_temp.test_id('publication-empty'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 2, 'closed', now() - interval '7 days', now() - interval '6 days', null),
  (pg_temp.test_id('publication-in-progress'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 3, 'closed', now() - interval '5 days', now() - interval '4 days', null),
  (pg_temp.test_id('publication-cancelled'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 4, 'cancelled', now() - interval '3 days', now() - interval '2 days', now() - interval '3 days'),
  (pg_temp.test_id('publication-open'), pg_temp.test_id('season-main'), pg_temp.test_id('challenge-version'), 5, 'open', now() - interval '1 hour', now() + interval '1 day', null),
  (pg_temp.test_id('publication-survival'), pg_temp.test_id('season-main'), pg_temp.test_id('survival-challenge-version'), 6, 'closed', now() - interval '2 days', now() - interval '1 day', null),
  (pg_temp.test_id('publication-pyramid'), pg_temp.test_id('season-main'), pg_temp.test_id('pyramid-challenge-version'), 7, 'closed', now() - interval '12 hours', now() - interval '11 hours', null),
  (pg_temp.test_id('publication-finished'), pg_temp.test_id('season-finished'), pg_temp.test_id('survival-challenge-version'), 1, 'closed', now() - interval '30 days', now() - interval '29 days', null);

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
  (pg_temp.test_id('attempt-invalidated'), pg_temp.test_id('dave'), pg_temp.test_id('publication-empty'), pg_temp.test_id('challenge-version'), 1, 'competitive', 'invalidated', now() - interval '6 days 2 hours', now() - interval '6 days 1 hour', null, 1, 1),
  (pg_temp.test_id('attempt-survival'), pg_temp.test_id('carol'), pg_temp.test_id('publication-survival'), pg_temp.test_id('survival-challenge-version'), 1, 'competitive', 'completed', now() - interval '2 days 2 hours', now() - interval '2 days 1 hour', 50, 1, 1),
  (pg_temp.test_id('attempt-pyramid'), pg_temp.test_id('carol'), pg_temp.test_id('publication-pyramid'), pg_temp.test_id('pyramid-challenge-version'), 1, 'competitive', 'completed', now() - interval '12 hours', now() - interval '11 hours', 15, 1, 1);
update public.attempts set outcome = 'passed' where id = pg_temp.test_id('attempt-survival');
update public.attempts set outcome = 'failed' where id = pg_temp.test_id('attempt-pyramid');
insert into private.flash_point_entries
  (season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
values
  (pg_temp.test_id('season-main'), pg_temp.test_id('alice'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-alice'), 'accreditation', 100, 's07-ledger-alice'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('carol'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-carol'), 'accreditation', 100, 's07-ledger-carol'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('dave'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-dave'), 'accreditation', 50, 's07-ledger-dave'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('former'), pg_temp.test_id('publication-completed'), pg_temp.test_id('attempt-former'), 'accreditation', 20, 's07-ledger-former'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('carol'), pg_temp.test_id('publication-survival'), pg_temp.test_id('attempt-survival'), 'accreditation', 50, 's07-ledger-survival'),
  (pg_temp.test_id('season-main'), pg_temp.test_id('carol'), pg_temp.test_id('publication-pyramid'), pg_temp.test_id('attempt-pyramid'), 'accreditation', 15, 's07-ledger-pyramid');
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
insert into private.answer_receipts
  (id, attempt_id, challenge_item_id, challenge_version_id, answer, received_at, presented_at,
   effective_submitted_at, time_used_ms, timed_out)
values
  (pg_temp.test_id('receipt-survival-one'), pg_temp.test_id('attempt-survival'), pg_temp.test_id('survival-item-one'), pg_temp.test_id('survival-challenge-version'), '"A"', now() - interval '2 days 2 hours', now() - interval '2 days 2 hours', now() - interval '2 days 2 hours', 600, false),
  (pg_temp.test_id('receipt-pyramid-one'), pg_temp.test_id('attempt-pyramid'), pg_temp.test_id('pyramid-item-one'), pg_temp.test_id('pyramid-challenge-version'), '"A"', now() - interval '12 hours', now() - interval '12 hours', now() - interval '12 hours', 700, false),
  (pg_temp.test_id('receipt-pyramid-two'), pg_temp.test_id('attempt-pyramid'), pg_temp.test_id('pyramid-item-two'), pg_temp.test_id('pyramid-challenge-version'), '"B"', now() - interval '12 hours', now() - interval '12 hours', now() - interval '12 hours', 800, false);
insert into private.attempt_answers
  (attempt_id, challenge_item_id, challenge_version_id, receipt_id, status, answer, result_details,
   points, presented_at, submitted_at, time_used_ms, idempotency_key)
values
  (pg_temp.test_id('attempt-survival'), pg_temp.test_id('survival-item-one'), pg_temp.test_id('survival-challenge-version'), pg_temp.test_id('receipt-survival-one'), 'correct', '"A"', '{}', 50, now() - interval '2 days 2 hours', now() - interval '2 days 2 hours', 600, 's07-answer-survival-one'),
  (pg_temp.test_id('attempt-pyramid'), pg_temp.test_id('pyramid-item-one'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('receipt-pyramid-one'), 'correct', '"A"', '{}', 15, now() - interval '12 hours', now() - interval '12 hours', 700, 's07-answer-pyramid-one'),
  (pg_temp.test_id('attempt-pyramid'), pg_temp.test_id('pyramid-item-two'), pg_temp.test_id('pyramid-challenge-version'), pg_temp.test_id('receipt-pyramid-two'), 'incorrect', '"B"', '{}', 0, now() - interval '12 hours', now() - interval '12 hours', 800, 's07-answer-pyramid-two');
set local session_replication_role = origin;

select ok(has_function_privilege('authenticated', 'public.get_room_history(text,uuid)', 'EXECUTE'),
  'Authenticated can query common room history');
select ok(not has_function_privilege('anon', 'public.get_room_history(text,uuid)', 'EXECUTE'),
  'Anonymous cannot query room history');
select ok(not has_function_privilege('service_role', 'public.get_room_member_review(text,uuid,uuid)', 'EXECUTE'),
  'service_role cannot use the application review boundary');
select ok(to_regprocedure('public.get_flash_history(text,uuid)') is null,
  'Legacy Flash history RPC is removed');
select ok(to_regprocedure('public.get_flash_member_review(text,uuid,uuid)') is null,
  'Legacy Flash member review RPC is removed');
select ok(position('public_payload' in pg_get_function_result(
  'public.get_room_history(text,uuid)'::regprocedure)) = 0,
  'Common history metadata has no question payload');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(distinct publication_id) from public.get_room_history('s07-test-room') where challenge_mode = 'flash'), 2::bigint,
  'Alice sees only closed publications without in-progress attempts');
select is((select count(distinct publication_id) from public.get_room_history('s07-test-room')), 5::bigint,
  'Common history includes Flash, Survival and Pyramid publications');
select is((select count(*) from public.get_room_history('s07-test-room')
  where publication_id = pg_temp.test_id('publication-finished')), 1::bigint,
  'Finished-season publications remain available in common history');
select is((select string_agg(distinct challenge_mode, ',' order by challenge_mode)
  from public.get_room_history('s07-test-room')), 'flash,pyramid,survival',
  'Common history exposes the persisted competitive mode');
select is((select count(*) from public.get_room_history('s07-test-room') where challenge_mode = 'flash' and publication_id = pg_temp.test_id('publication-empty')), 1::bigint,
  'A closed publication without ranked results remains visible');
select is((select player_count from public.get_room_history('s07-test-room') where challenge_mode = 'flash' and publication_id = pg_temp.test_id('publication-empty')), 1::bigint,
  'Abandoned competitive attempts count as distinct participation');
select is((select string_agg(position::text, ',' order by position, player_id) from public.get_room_history('s07-test-room') where challenge_mode = 'flash' and publication_id = pg_temp.test_id('publication-completed')), '1,1,3,4',
  'Historical ranking applies points, duration and started_at ordering');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol'))), 2::bigint,
  'A member can review an abandoned attempt');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol')) where answer_status is null), 1::bigint,
  'Missing abandoned answers are returned as empty answer slots');
select ok(exists (select 1 from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('carol')) where solution_payload::text like '%S07 solution two%'),
  'Authorized review receives the immutable solution payload');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-survival'), pg_temp.test_id('carol'))), 1::bigint,
  'Survival review returns only reached persisted questions');
select is((select attempt_outcome from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-survival'), pg_temp.test_id('carol')) limit 1), 'passed',
  'Survival review preserves the persisted outcome');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-pyramid'), pg_temp.test_id('carol'))), 7::bigint,
  'Pyramid review returns all seven levels');
select ok(exists (select 1 from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-pyramid'), pg_temp.test_id('carol'))
  where item_position = 1 and public_payload is not null and solution_payload is not null and has_persisted_answer),
  'Reached Pyramid levels include their payloads and solutions');
select ok(exists (select 1 from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-pyramid'), pg_temp.test_id('carol'))
  where item_position = 7 and public_payload is null and solution_payload is null and not has_persisted_answer
    and level_label = 'Nivel 7' and briefing_title = 'Briefing 7'),
  'Unreached Pyramid levels expose metadata but no payload or solution');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('alice'))), 0::bigint,
  'A player without a result has no review rows');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-empty'), pg_temp.test_id('dave'))), 0::bigint,
  'Invalidated attempts are absent from review');
select is((select count(*) from public.get_room_history('s07-other-room')), 0::bigint,
  'A room member cannot cross into another room without history');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-bob'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(distinct publication_id) from public.get_room_history('s07-test-room')), 5::bigint,
  'Spectator can read history metadata');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-completed'), pg_temp.test_id('alice'))), 0::bigint,
  'Spectator cannot review another member');
select is((select count(*) from public.get_room_member_review('s07-test-room', pg_temp.test_id('publication-pyramid'), pg_temp.test_id('carol'))), 0::bigint,
  'Spectator cannot review through the common RPC');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_room_history('s07-missing-room')), 0::bigint,
  'Unknown room has the same absence as an unauthorized scope');
select * from finish();
rollback;
