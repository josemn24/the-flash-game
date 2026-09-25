begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

-- A disposable mixed Flash version with a real private dictionary plus
-- question-specific biblical words that are deliberately absent from it.
insert into private.mini_wordle_dictionary_words(dictionary_id, word_length, word)
values
  ('es-general-5.v1', 5, 'SALON');
insert into public.rooms(id, slug, title)
values (test_support.id('e01-room'), 'e01-mini-wordle-room', 'Sala E01');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('e01-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e01-season'), test_support.id('e01-room'), 'Temporada E01', 'active',
  now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('e01-q'), 'e01-mini-wordle', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id)
values (
  test_support.id('e01-qv'), test_support.id('e01-q'), 1, 1, 'draft', 'mini-wordle',
  60000, '{"category":"Biblia","question":"Descubre el personaje bíblico","hint":"Una figura central del cristianismo","wordLength":5,"maxAttempts":4}',
  test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e01-qv'), '{"correctAnswer":"JESUS","additionalGuesses":["JOSUE","JACOB"],"dictionaryId":"es-general-5.v1","explanation":"Jesús es una figura central del cristianismo."}');
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('e01-qv-2'), question_definition_id, 2, payload_schema_version, 'draft', type, time_limit_ms, public_payload, created_by_player_id
from private.question_versions where id = test_support.id('e01-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('e01-qv-2'), solution_payload from private.question_version_solutions where question_version_id = test_support.id('e01-qv');
update private.question_versions set status = 'published', published_at = now()
where id in (test_support.id('e01-qv'), test_support.id('e01-qv-2'));
select ok(private.is_supported_flash_question(test_support.id('e01-qv')),
  'Mini-Wordle publicado válido sigue admitido como pregunta Flash');
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('e01-cd'), 'e01-mini-wordle-flash', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  test_support.id('e01-cv'), test_support.id('e01-cd'), 1, 1, 'draft', 'flash',
  'Flash Mini-Wordle', 'Dos eventos de palabra', 'Prueba competitiva de Mini-Wordle.',
  100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e01-item-1'), test_support.id('e01-cv'), test_support.id('e01-qv'), 1, 50, 1, '{}'),
  (test_support.id('e01-item-2'), test_support.id('e01-cv'), test_support.id('e01-qv-2'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('e01-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e01-sc'), test_support.id('e01-season'), test_support.id('e01-cv'), 20, 'open', now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('e01-sc'), 'sessionToken', repeat('e', 40)));
select test_support.run('prepare_interaction');
select ok(not ((select last_result from test_support.runtime)::text like '%JESUS%'), 'Prepare no expone la solución');
select ok(not ((select last_result from test_support.runtime)::text like '%JOSUE%'), 'Prepare no expone palabras extra privadas');
select ok((select last_result ? 'progress' from test_support.runtime), 'Prepare devuelve progreso seguro');
select is((select jsonb_array_length(last_result->'progress'->'guesses') from test_support.runtime), 0, 'El progreso empieza vacío');
reset role;

select lives_ok($$select test_support.run('submit_mini_wordle_guess', '{"guess":"JOSUE"}')$$, 'Una palabra extra de la pregunta crea un evento');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), false, 'Una palabra incorrecta no termina el item');
select is((select count(*) from private.mini_wordle_guess_events), 1::bigint, 'Existe un evento intermedio');
select is((select count(*) from private.attempt_answers), 0::bigint, 'Un evento intermedio no crea attempt_answers');
select ok((select (last_result->'feedback'->0->>'status') = 'correct' from test_support.runtime), 'El feedback usa la solución privada');
select ok((select (last_result->'feedback'->4->>'status') = 'present' from test_support.runtime), 'El feedback de palabras extra conserva las posiciones');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'Repetir la idempotency key devuelve el mismo evento');
select throws_ok($$select test_support.repeat_last('{"guess":"JACOB"}')$$, '40001', 'idempotency_conflict', 'Reutilizar la clave con otra palabra se rechaza');
select throws_ok($$select test_support.run('submit_mini_wordle_guess', '{"guess":"ZZZZZ"}')$$, '22023', 'invalid_mini_wordle_guess', 'La palabra fuera de ambos conjuntos no consume intento');
select is((select count(*) from private.mini_wordle_guess_events), 1::bigint, 'La palabra inválida no inserta evento');
select throws_ok($$select test_support.run('submit_mini_wordle_guess', '{"guess":"JOSUE"}')$$, '55000', 'duplicate_mini_wordle_guess', 'La palabra extra repetida no consume intento');
select is((select count(*) from private.mini_wordle_guess_events), 1::bigint, 'La palabra repetida no inserta evento');

select lives_ok($$select test_support.run('submit_mini_wordle_guess', '{"guess":"SALON"}')$$, 'Una palabra del diccionario general también crea un evento');
select is((select count(*) from private.mini_wordle_guess_events), 2::bigint, 'El intento general consume una posición');
select lives_ok($$select test_support.run('submit_mini_wordle_guess', '{"guess":"JESUS"}')$$, 'La solución extra se acepta aunque no esté en el diccionario general');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), true, 'La solución termina el item');
select ok((select last_result ? 'receiptId' from test_support.runtime), 'El item terminal crea una recepción');
select is((select count(*) from private.answer_receipts), 1::bigint, 'Existe una única recepción final');
select is((select count(*) from private.attempt_answers), 0::bigint, 'La recepción aún espera evaluación');
select is((select answer->'guesses' from private.answer_receipts), '["JOSUE", "SALON", "JESUS"]'::jsonb, 'La respuesta final se construye desde eventos');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select is((select count(*) from private.attempt_answers), 1::bigint, 'La evaluación crea un único resultado final');
select test_support.run('prepare_interaction');
select test_support.run('submit_mini_wordle_guess', '{"guess":"JACOB"}');
select throws_ok($$select private.submit_mini_wordle_guess(jsonb_build_object('idempotencyKey','stale-mini-key','attemptId',(select (state->>'attemptId')::uuid from test_support.runtime),'lockVersion',1,'sessionToken',repeat('e',40),'challengeItemId',test_support.id('e01-item-2'),'guess','JACOB'))$$, '40001', 'stale_version', 'Una versión obsoleta se rechaza');
reset role;
select * from finish();
rollback;
