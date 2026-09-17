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
$$, 'El validador acepta un Flash mixto con Matching');
select is(to_regclass('private.matching_pair_events_item_idx')::text, 'private.matching_pair_events_item_idx', 'Existe el índice principal de eventos Matching');
select ok((select relrowsecurity from pg_class where oid = 'private.matching_pair_events'::regclass), 'RLS está habilitado para los eventos Matching');
select ok(not has_table_privilege('service_role', 'private.matching_pair_events', 'SELECT'), 'service_role no lee la tabla de eventos directamente');

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
update private.question_versions set status = 'published', published_at = now() where id = test_support.id('e04-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id) values (test_support.id('e04-cd'), 'e04-matching-flash', test_support.id('superadmin'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('e04-cv'), test_support.id('e04-cd'), 1, 1, 'draft', 'flash', 'Flash Matching', 'Parejas', 'Prueba E04.', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e04-item'), test_support.id('e04-cv'), test_support.id('e04-qv'), 1, 50, 1, '{}'),
  (test_support.id('e04-item-2'), test_support.id('e04-cv'), test_support.id('e04-qv'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now() where id = test_support.id('e04-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e04-sc'), test_support.id('e04-season'), test_support.id('e04-cv'), 20, 'open', now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('e04-sc'), 'sessionToken', repeat('m', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%matches%'), 'Prepare no expone el solutionPayload');
select ok(not ((select last_result from test_support.runtime)::text like '%correctMatchId%'), 'Prepare no expone correctMatchId');
select is((select last_result->'progress'->>'matchedCount' from test_support.runtime), '0', 'El progreso Matching empieza vacío');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"l1":"r1"}}')$$, '22023', 'matching_requires_pair_command', 'El dispatcher genérico exige el comando de pareja');
reset role;

select lives_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l1","rightItemId":"r2"}')$$, 'Una pareja incorrecta crea un evento');
select is((select last_result->>'correct' from test_support.runtime), 'false', 'El feedback incorrecto procede del servidor');
select is((select (last_result->>'penaltyPoints')::integer from test_support.runtime), 5, 'La penalización es el 10% de los puntos del item');
select is((select count(*) from private.matching_pair_events), 1::bigint, 'El fallo queda persistido');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'La misma solicitud es idempotente');
select throws_ok($$select test_support.repeat_last('{"rightItemId":"r1"}')$$, '40001', 'idempotency_conflict', 'La clave idempotente no cambia de pareja');

select lives_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l1","rightItemId":"r1"}')$$, 'Una pareja correcta se persiste');
select is((select (last_result->>'matchedCount')::integer from test_support.runtime), 1, 'La pareja correcta aparece en el progreso');
select throws_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l1","rightItemId":"r1"}')$$, '55000', 'duplicate_matching_pair', 'Una pareja exacta repetida no genera otro evento');
select throws_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l1","rightItemId":"r3"}')$$, '55000', 'matching_item_already_resolved', 'Una tarjeta ya resuelta no se puede reutilizar');
select lives_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l2","rightItemId":"r2"}')$$, 'La segunda pareja correcta se acepta');
select lives_ok($$select test_support.run('submit_matching_pair', '{"leftItemId":"l3","rightItemId":"r3"}')$$, 'La última pareja cierra la interacción');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), true, 'Completar todas las parejas es terminal');
select is((select count(*) from private.answer_receipts), 1::bigint, 'La resolución crea una recepción final');
select is((select last_result->'matchedPairs' from test_support.runtime), '[{"leftId":"l1","rightId":"r1"},{"leftId":"l2","rightId":"r2"},{"leftId":"l3","rightId":"r3"}]'::jsonb, 'El resultado devuelve solo parejas correctas');

select test_support.as_actor('owner');
set local role service_role;
select is((select private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('m', 40))->'answer' from test_support.runtime), '{"l1":"r1","l2":"r2","l3":"r3"}'::jsonb, 'La evaluación reconstruye el mapa desde eventos');
select is((select (private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('m', 40))->>'matchingIncorrectAttempts')::integer from test_support.runtime), 1, 'La evaluación cuenta los fallos persistidos');
reset role;
select test_support.run('record_evaluation', '{"status":"partial","points":45}');
select is((select count(*) from private.attempt_answers), 1::bigint, 'El resultado evaluado queda persistido');

select * from finish();
rollback;
