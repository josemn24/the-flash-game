begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

insert into public.rooms(id, slug, title)
values (test_support.id('e02-room'), 'e02-logic-code-room', 'Sala E02');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('e02-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e02-season'), test_support.id('e02-room'), 'Temporada E02', 'active',
  now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('e02-q'), 'e02-logic-code', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id)
values (
  test_support.id('e02-qv'), test_support.id('e02-q'), 1, 1, 'draft', 'logic-code',
  60000, '{"category":"Lógica","question":"Descubre el código","codeLength":4,"clues":[{"code":"1203","hint":"El segundo dígito es el doble del primero."},{"code":"0312","hint":"El último dígito coincide con el tercero."}]}',
  test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e02-qv'), '{"correctAnswer":"0420","explanation":"La secuencia satisface las pistas."}');
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('e02-qv-2'), question_definition_id, 2, payload_schema_version, 'draft', type, time_limit_ms, public_payload, created_by_player_id
from private.question_versions where id = test_support.id('e02-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('e02-qv-2'), solution_payload from private.question_version_solutions where question_version_id = test_support.id('e02-qv');
update private.question_versions set status = 'published', published_at = now()
where id in (test_support.id('e02-qv'), test_support.id('e02-qv-2'));
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('e02-cd'), 'e02-logic-code-flash', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  test_support.id('e02-cv'), test_support.id('e02-cd'), 1, 1, 'draft', 'flash',
  'Flash Logic-code', 'Dos preguntas de lógica', 'Prueba competitiva de Logic-code.',
  100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e02-item-1'), test_support.id('e02-cv'), test_support.id('e02-qv'), 1, 50, 1, '{}'),
  (test_support.id('e02-item-2'), test_support.id('e02-cv'), test_support.id('e02-qv-2'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('e02-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e02-sc'), test_support.id('e02-season'), test_support.id('e02-cv'), 20, 'open',
  now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('e02-sc'), 'sessionToken', repeat('e', 40)));
select test_support.run('prepare_interaction');
select ok(not ((select last_result from test_support.runtime)::text like '%0420%'), 'Prepare no expone la solución');
select is((select last_result->'progress'->'submittedCodes' from test_support.runtime), '[]'::jsonb,
  'El progreso Logic-code empieza vacío');
select throws_ok($$select test_support.run('receive_answer', '{"answer":"0420"}')$$,
  '22023', 'logic_code_requires_attempt_command', 'El dispatcher genérico no acepta respuestas Logic-code');
reset role;

select lives_ok($$select test_support.run('submit_logic_code_attempt', '{"code":"0000"}')$$,
  'Un código incorrecto válido crea un evento');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), false,
  'Un código incorrecto no termina el item');
select is((select (last_result->>'incorrectAttempts')::integer from test_support.runtime), 1,
  'El contador refleja el intento incorrecto');
select is((select count(*) from private.logic_code_attempt_events), 1::bigint,
  'Existe un único evento de código');
select is((select count(*) from private.answer_receipts), 0::bigint,
  'Un intento incorrecto no crea recepción final');
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'Repetir la clave idempotente devuelve el mismo evento');
select throws_ok($$select test_support.repeat_last('{"code":"0001"}')$$,
  '40001', 'idempotency_conflict', 'La clave no se puede reutilizar para otro código');

select throws_ok($$select test_support.run('submit_logic_code_attempt', '{"code":"0000"}')$$,
  '55000', 'duplicate_logic_code', 'Un código duplicado se rechaza sin penalización');
select is((select count(*) from private.logic_code_attempt_events), 1::bigint,
  'El duplicado no inserta un segundo evento');
select throws_ok($$select test_support.run('submit_logic_code_attempt', '{"code":"12"}')$$,
  '22023', 'invalid_logic_code', 'La longitud incorrecta no consume intento');
select is((select count(*) from private.logic_code_attempt_events), 1::bigint,
  'El código inválido no inserta evento');

select lives_ok($$select test_support.run('submit_logic_code_attempt', '{"code":"0420"}')$$,
  'La solución conserva los ceros iniciales');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), true,
  'La solución termina el item');
select is((select (last_result->>'incorrectAttempts')::integer from test_support.runtime), 1,
  'La solución conserva el contador de penalizaciones');
select ok((select last_result ? 'receiptId' from test_support.runtime), 'La solución crea recepción');
select is((select answer from private.answer_receipts), '"0420"'::jsonb,
  'La recepción conserva los ceros iniciales');
select is((select count(*) from private.answer_receipts), 1::bigint, 'Existe una recepción final');
select is((select count(*) from private.attempt_answers), 0::bigint, 'La recepción espera evaluación');
select test_support.as_actor('owner');
set local role service_role;
select is((select private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('e', 40)
)->'submittedCodes' from test_support.runtime), '["0000", "0420"]'::jsonb,
  'El contexto de evaluación reconstruye la secuencia persistida');
select is((select (private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('e', 40)
)->>'incorrectAttempts')::integer from test_support.runtime), 1,
  'El contexto de evaluación reconstruye la penalización');
reset role;

select test_support.run('record_evaluation', '{"status":"correct","points":40}');
select is((select count(*) from private.attempt_answers), 1::bigint, 'La evaluación crea un resultado final');
select test_support.run('prepare_interaction');
select test_support.run('submit_logic_code_attempt', '{"code":"1111"}');
select * from finish();
rollback;
