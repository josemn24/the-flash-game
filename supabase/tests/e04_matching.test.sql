begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','e04-editorial','title','E04','subtitle','Parejas','description','E04','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('slug','e04-choice','type','multiple-choice','payloadSchemaVersion',1,'timeLimitMs',15000,'points',50,
        'publicPayload',jsonb_build_object('question','¿Capital?','options',jsonb_build_array('Lisboa','Madrid')),
        'solutionPayload',jsonb_build_object('correctAnswer','Lisboa')),
      jsonb_build_object('slug','e04-matching','type','matching','payloadSchemaVersion',1,'timeLimitMs',60000,'points',50,
        'publicPayload',jsonb_build_object('question','Relaciona cada término','leftItems',jsonb_build_array(
          jsonb_build_object('id','l1','label','Uno'),jsonb_build_object('id','l2','label','Dos'),jsonb_build_object('id','l3','label','Tres')),
          'rightItems',jsonb_build_array(
          jsonb_build_object('id','r1','label','Primero'),jsonb_build_object('id','r2','label','Segundo'),jsonb_build_object('id','r3','label','Tercero'))),
        'solutionPayload',jsonb_build_object('matches',jsonb_build_object('l1','r1','l2','r2','l3','r3')))
    )))
$$, 'El validador acepta un Flash con Matching');
select ok(to_regprocedure('private.matching_answer_valid(jsonb,jsonb,boolean)') is not null,
  'Existe el validador server-side de respuestas Matching');

insert into public.rooms(id, slug, title) values (test_support.id('e04-room'), 'e04-matching-room', 'Sala E04');
insert into public.room_memberships(room_id, player_id, role) values (test_support.id('e04-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e04-season'), test_support.id('e04-room'), 'Temporada E04', 'active', now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id) values (test_support.id('e04-q'), 'e04-matching', test_support.id('superadmin'));
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('e04-qv'), test_support.id('e04-q'), 1, 1, 'draft', 'matching', 60000,
  '{"question":"Relaciona cada término","leftItems":[{"id":"l1","label":"Uno"},{"id":"l2","label":"Dos"},{"id":"l3","label":"Tres"}],"rightItems":[{"id":"r1","label":"Primero"},{"id":"r2","label":"Segundo"},{"id":"r3","label":"Tercero"}]}', test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e04-qv'), '{"matches":{"l1":"r1","l2":"r2","l3":"r3"},"explanation":"Correspondencias."}');
update private.question_versions set status = 'published', published_at = now()
where id = test_support.id('e04-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id) values (test_support.id('e04-cd'), 'e04-matching-flash', test_support.id('superadmin'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('e04-cv'), test_support.id('e04-cd'), 1, 1, 'draft', 'flash', 'Flash Matching', 'Parejas', 'Prueba E04.', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values (test_support.id('e04-item'), test_support.id('e04-cv'), test_support.id('e04-qv'), 1, 100, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('e04-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e04-sc'), test_support.id('e04-season'), test_support.id('e04-cv'), 20, 'open', now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('e04-sc'), 'sessionToken', repeat('m', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%matches%'), 'Prepare no expone la solución');
select ok(not ((select last_result from test_support.runtime)::text like '%correctMatchId%'), 'Prepare no expone correctMatchId');
select ok((select last_result->>'progress' from test_support.runtime) is null, 'Matching no expone progreso server-side');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"l1":"r1"}}')$$, '22023', 'invalid_matching_answer', 'Un mapa incompleto se rechaza antes del deadline');
select throws_ok($$select test_support.run('receive_answer', '{"answer":null}')$$, '22023', 'invalid_matching_answer', 'Una respuesta null se rechaza antes del deadline');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"l1":"r1","l2":"r1","l3":"r3"}}')$$, '22023', 'invalid_matching_answer', 'Un mapa con derechos duplicados se rechaza');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"lx":"r1","l2":"r2","l3":"r3"}}')$$, '22023', 'invalid_matching_answer', 'Un mapa con una clave izquierda inventada se rechaza');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"l1":"rx","l2":"r2","l3":"r3"}}')$$, '22023', 'invalid_matching_answer', 'Un mapa con un valor derecho inventado se rechaza');

select lives_ok($$select test_support.run('receive_answer', '{"answer":{"l1":"r2","l2":"r1","l3":"r3"}}')$$,
  'Un mapa completo se recibe en una única petición');
select is((select count(*) from private.answer_receipts), 1::bigint, 'La comprobación crea una única recepción');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'La recepción final es idempotente');
select throws_ok($$select test_support.repeat_last('{"answer":{"l1":"r1","l2":"r2","l3":"r3"}}')$$,
  '40001', 'idempotency_conflict', 'La clave no puede reutilizarse con otro mapa');

select test_support.as_actor('owner');
set local role service_role;
select is((select private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('m', 40))->'answer' from test_support.runtime),
  '{"l1":"r2","l2":"r1","l3":"r3"}'::jsonb, 'La evaluación utiliza el mapa completo recibido');
select is((select private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('m', 40))->>'matchingIncorrectAttempts' from test_support.runtime), null,
  'La evaluación no cuenta errores por pareja');
reset role;
select test_support.run('record_evaluation', '{"status":"incorrect","points":0,"resultDetails":{"type":"matching","correctPairs":1,"totalPairs":3}}'::jsonb);
select is((select count(*) from private.attempt_answers), 1::bigint, 'El resultado final queda persistido');
select is((select result_details->>'incorrectAttempts' from private.attempt_answers), null, 'El resultado nuevo no persiste penalización por pareja');

select * from finish();
rollback;
