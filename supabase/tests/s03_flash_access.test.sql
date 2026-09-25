-- S03: public gameplay projection, server command boundary and terminal review.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('s03-flash:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id) values
  (pg_temp.test_id('auth-owner')),
  (pg_temp.test_id('auth-spectator'));
insert into public.players (id, auth_user_id, display_name) values
  (pg_temp.test_id('owner'), pg_temp.test_id('auth-owner'), 'Owner S03'),
  (pg_temp.test_id('spectator'), pg_temp.test_id('auth-spectator'), 'Spectator S03');
insert into public.rooms (id, slug, title) values
  (pg_temp.test_id('room'), 's03-test-room', 'Sala de pruebas S03');
insert into public.room_memberships (room_id, player_id, role) values
  (pg_temp.test_id('room'), pg_temp.test_id('owner'), 'owner'),
  (pg_temp.test_id('room'), pg_temp.test_id('spectator'), 'spectator');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (pg_temp.test_id('season'), pg_temp.test_id('room'), 'Temporada S03', 'active',
  now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions (id, slug, created_by_player_id) values
  (pg_temp.test_id('question-one'), 's03-test-question-one', pg_temp.test_id('owner')),
  (pg_temp.test_id('question-two'), 's03-test-question-two', pg_temp.test_id('owner'));
insert into private.question_versions
  (id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
values
  (pg_temp.test_id('question-version-one'), pg_temp.test_id('question-one'), 1, 'multiple-choice', 60000,
    '{"id":"q1","question":"Pregunta uno","options":["A","B"]}', pg_temp.test_id('owner')),
  (pg_temp.test_id('question-version-two'), pg_temp.test_id('question-two'), 1, 'multiple-choice', 60000,
    '{"id":"q2","question":"Pregunta dos","options":["A","B"]}', pg_temp.test_id('owner'));
insert into private.question_version_solutions (question_version_id, solution_payload) values
  (pg_temp.test_id('question-version-one'), '{"correctAnswer":"A","explanation":"Solución uno"}'),
  (pg_temp.test_id('question-version-two'), '{"correctAnswer":"B","explanation":"Solución dos"}');
update private.question_versions set status = 'published';
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (pg_temp.test_id('challenge'), 's03-test-challenge', pg_temp.test_id('owner'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, mode, title, subtitle, description, created_by_player_id)
values (pg_temp.test_id('challenge-version'), pg_temp.test_id('challenge'), 1, 'flash',
  'Flash S03 de prueba', 'Dos preguntas', 'Fixture pgTAP', pg_temp.test_id('owner'));
insert into private.challenge_items (id, challenge_version_id, question_version_id, position, points) values
  (pg_temp.test_id('item-one'), pg_temp.test_id('challenge-version'), pg_temp.test_id('question-version-one'), 1, 50),
  (pg_temp.test_id('item-two'), pg_temp.test_id('challenge-version'), pg_temp.test_id('question-version-two'), 2, 50);
update private.challenge_versions set status = 'published';
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (pg_temp.test_id('publication'), pg_temp.test_id('season'), pg_temp.test_id('challenge-version'), 1,
  'open', now() - interval '1 hour', now() + interval '1 day');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-owner'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_flash_challenge(
  's03-test-room', pg_temp.test_id('publication'))), 2::bigint,
  'Competitive player receives both public questions');
select ok(position('public_payload' in pg_get_function_result(
  'public.get_my_flash_challenge(text,uuid)'::regprocedure
)) = 0, 'Playable projection exposes no question payload at all');
select is((select count(*) from public.get_my_flash_result(pg_temp.test_id('missing-attempt'))), 0::bigint,
  'Missing result is absent');
select throws_ok($$select solution_payload from private.question_version_solutions$$, '42501', null,
  'Authenticated cannot read private solutions');
select ok(not has_function_privilege('authenticated', 'private.start_attempt(jsonb)', 'EXECUTE'),
  'Browser cannot execute server command wrappers');
reset role;

-- The server adapter is represented by authenticator -> service_role in production.
set local role service_role;
create temp table s03_state(result jsonb not null);
grant select on s03_state to authenticated;
insert into s03_state
select private.start_attempt(jsonb_build_object(
  'idempotencyKey', 's03-test-start',
  'scheduledChallengeId', pg_temp.test_id('publication'),
  'sessionToken', repeat('s', 40)
));
select is((select result->>'resumed' from s03_state), 'false', 'Start creates one fresh attempt');
update s03_state set result = private.prepare_interaction(jsonb_build_object(
  'idempotencyKey', 's03-test-prepare-1', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40)
));
select ok((select result ? 'publicPayload' from s03_state), 'Prepare returns public content');
select ok(not exists (
  select 1 from s03_state where result::text like '%correctAnswer%'
), 'Prepare never returns the private solution');
select throws_ok($$select private.receive_answer(jsonb_build_object(
  'idempotencyKey','s03-test-bad-order','attemptId',(select result->>'attemptId' from s03_state),
  'lockVersion',(select (result->>'lockVersion')::bigint from s03_state),'sessionToken',repeat('s',40),
  'challengeItemId',pg_temp.test_id('item-two'),'answer','B'))$$, '55000', null,
  'Answer for a non-presented item is rejected');
update s03_state set result = private.receive_answer(jsonb_build_object(
  'idempotencyKey', 's03-test-answer-1', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40),
  'challengeItemId', pg_temp.test_id('item-one'), 'answer', 'A', 'clientTimeUsedMs', 999999
));
select ok((select result ? 'receiptId' from s03_state), 'One receipt is persisted');
update s03_state set result = private.record_evaluation(jsonb_build_object(
  'idempotencyKey', 's03-test-evaluation-1', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40),
  'receiptId', result->>'receiptId', 'status', 'correct', 'points', 50
));
update s03_state set result = private.prepare_interaction(jsonb_build_object(
  'idempotencyKey', 's03-test-prepare-2', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40)
));
update s03_state set result = private.receive_answer(jsonb_build_object(
  'idempotencyKey', 's03-test-answer-2', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40),
  'challengeItemId', pg_temp.test_id('item-two'), 'answer', 'A'
));
update s03_state set result = private.record_evaluation(jsonb_build_object(
  'idempotencyKey', 's03-test-evaluation-2', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40),
  'receiptId', result->>'receiptId', 'status', 'incorrect', 'points', 0
));
update s03_state set result = private.complete_attempt(jsonb_build_object(
  'idempotencyKey', 's03-test-complete', 'attemptId', result->>'attemptId',
  'lockVersion', (result->>'lockVersion')::bigint, 'sessionToken', repeat('s', 40), 'score', 50
));
select is((select result->>'status' from s03_state), 'completed', 'Two evaluated answers complete the attempt');
select is((select count(*) from private.flash_point_entries), 1::bigint, 'Completion creates one accreditation');
select is((select count(*) from private.attempt_answers), 2::bigint, 'Exactly two evaluated answers exist');
reset role;

set local role authenticated;
select is((select count(*) from public.get_my_flash_result(
  (select (result->>'attemptId')::uuid from s03_state))), 2::bigint,
  'Owner receives terminal review rows');
select ok(exists (
  select 1 from public.get_my_flash_result((select (result->>'attemptId')::uuid from s03_state))
  where solution_payload::text like '%correctAnswer%'
), 'Solutions are released only in terminal own review');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-spectator'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_flash_challenge(
  's03-test-room', pg_temp.test_id('publication'))), 0::bigint,
  'Spectator receives no competitive questions');
reset role;

select * from finish();
rollback;
