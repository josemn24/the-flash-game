begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','e06-editorial','title','E06','subtitle','Sopa','description','E06','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('slug','e06-word-search','type','word-search','payloadSchemaVersion',1,'timeLimitMs',60000,'points',50,
        'publicPayload',jsonb_build_object('question','Encuentra las palabras','grid',jsonb_build_object('rows',6,'columns',6),
          'letters',jsonb_build_array('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','Ñ','Á','É','Í','Ó','Ú','Ü','D','E','F'),
          'targets',jsonb_build_array(jsonb_build_object('id','abc','word','ABC'),jsonb_build_object('id','mno','word','MNO'))),
        'solutionPayload',jsonb_build_object('positionsByTargetId',jsonb_build_object('abc',jsonb_build_object('startCell',0,'endCell',2),'mno',jsonb_build_object('startCell',12,'endCell',14)))),
      jsonb_build_object('slug','e06-word-search-copy','type','word-search','payloadSchemaVersion',1,'timeLimitMs',60000,'points',50,
        'publicPayload',jsonb_build_object('question','Encuentra las palabras','grid',jsonb_build_object('rows',6,'columns',6),
          'letters',jsonb_build_array('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','Ñ','Á','É','Í','Ó','Ú','Ü','D','E','F'),
          'targets',jsonb_build_array(jsonb_build_object('id','abc','word','ABC'),jsonb_build_object('id','mno','word','MNO'))),
        'solutionPayload',jsonb_build_object('positionsByTargetId',jsonb_build_object('abc',jsonb_build_object('startCell',0,'endCell',2),'mno',jsonb_build_object('startCell',12,'endCell',14))))
    )))
$$, 'El validador editorial acepta Word-search con Ñ y payload privado');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','e06-invalid','title','E06','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('slug','e06-invalid','type','word-search','payloadSchemaVersion',1,'timeLimitMs',60000,'points',50,
        'publicPayload',jsonb_build_object('question','Sopa','grid',jsonb_build_object('rows',6,'columns',6),
          'letters',jsonb_build_array('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','Ñ','Á','É','Í','Ó','Ú','Ü','D','E','F'),
          'targets',jsonb_build_array(jsonb_build_object('id','abc','word','ABC'),jsonb_build_object('id','mno','word','MNO')), 'startCell',0),
        'solutionPayload',jsonb_build_object('positionsByTargetId',jsonb_build_object('abc',jsonb_build_object('startCell',0,'endCell',2),'mno',jsonb_build_object('startCell',12,'endCell',14))))
    )))
$$, '22023', 'incomplete_content', 'El documento no válido no llega a publicar un payload con posiciones');

select is(to_regclass('private.word_search_selection_events_item_idx')::text, 'private.word_search_selection_events_item_idx', 'Existe el índice de eventos Word-search');
select ok((select relrowsecurity from pg_class where oid = 'private.word_search_selection_events'::regclass), 'RLS está habilitado para Word-search');
select ok(not has_table_privilege('service_role', 'private.word_search_selection_events', 'SELECT'), 'service_role no lee eventos Word-search directamente');

insert into public.rooms(id, slug, title) values (test_support.id('e06-room'), 'e06-word-search-room', 'Sala E06');
insert into public.room_memberships(room_id, player_id, role) values (test_support.id('e06-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e06-season'), test_support.id('e06-room'), 'Temporada E06', 'active', now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id) values (test_support.id('e06-q'), 'e06-word-search', test_support.id('superadmin'));
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('e06-qv'), test_support.id('e06-q'), 1, 1, 'draft', 'word-search', 60000,
  '{"question":"Encuentra las palabras","grid":{"rows":6,"columns":6},"letters":["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","Ñ","Á","É","Í","Ó","Ú","Ü","D","E","F"],"targets":[{"id":"abc","word":"ABC"},{"id":"mno","word":"MNO"}]}', test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e06-qv'), '{"positionsByTargetId":{"abc":{"startCell":0,"endCell":2},"mno":{"startCell":12,"endCell":14}}}');
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('e06-qv-2'), question_definition_id, 2, payload_schema_version, 'draft', type, time_limit_ms, public_payload, created_by_player_id
from private.question_versions where id = test_support.id('e06-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('e06-qv-2'), solution_payload from private.question_version_solutions where question_version_id = test_support.id('e06-qv');
update private.question_versions set status = 'published', published_at = now() where id in (test_support.id('e06-qv'), test_support.id('e06-qv-2'));
select ok(private.is_supported_flash_question(test_support.id('e06-qv')), 'Word-search publicado es jugable');
insert into private.challenge_definitions(id, slug, created_by_player_id) values (test_support.id('e06-cd'), 'e06-word-search-flash', test_support.id('superadmin'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('e06-cv'), test_support.id('e06-cd'), 1, 1, 'draft', 'flash', 'Flash Word-search', 'Sopa', 'Prueba E06.', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e06-item'), test_support.id('e06-cv'), test_support.id('e06-qv'), 1, 50, 1, '{}'),
  (test_support.id('e06-item-2'), test_support.id('e06-cv'), test_support.id('e06-qv-2'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now() where id = test_support.id('e06-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e06-sc'), test_support.id('e06-season'), test_support.id('e06-cv'), 21, 'open', now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('e06-sc'), 'sessionToken', repeat('w', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%startCell%'), 'Prepare no expone posiciones privadas');
select is((select last_result->'progress'->>'foundCount' from test_support.runtime), '0', 'El progreso empieza vacío');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"foundWordIds":["abc"]}}')$$, '22023', 'word_search_requires_selection_command', 'El dispatcher genérico exige el comando de selección');

select lives_ok($$select test_support.run('submit_word_search_selection', '{"startCell":0,"endCell":3}')$$, 'Una selección incorrecta se acepta como evento');
select is((select last_result->>'correct' from test_support.runtime), 'false', 'El servidor marca el fallo');
select is((select (last_result->>'incorrectAttempts')::integer from test_support.runtime), 1, 'Los fallos incrementan el contador');
select is((select count(*) from private.word_search_selection_events), 1::bigint, 'Los fallos quedan persistidos');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'La selección incorrecta es idempotente');
select throws_ok($$select test_support.repeat_last('{"endCell":4}')$$, '40001', 'idempotency_conflict', 'La clave no puede reutilizarse con otro segmento');

select lives_ok($$select test_support.run('submit_word_search_selection', '{"startCell":2,"endCell":0}')$$, 'La selección correcta acepta el sentido inverso');
select is((select last_result->>'matchedTargetId' from test_support.runtime), 'abc', 'La resolución del objetivo es server-side');
select throws_ok($$select test_support.run('submit_word_search_selection', '{"startCell":0,"endCell":2}')$$, '55000', 'word_search_target_already_found', 'Un objetivo ya resuelto no puede resolverse de nuevo');
select lives_ok($$select test_support.run('submit_word_search_selection', '{"startCell":12,"endCell":14}')$$, 'La última palabra cierra el tablero');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), true, 'Completar objetivos es terminal');
select is((select count(*) from private.answer_receipts), 1::bigint, 'El cierre crea una única recepción');
select is((select last_result->'foundWordIds' from test_support.runtime), '["abc","mno"]'::jsonb, 'El resultado solo devuelve objetivos encontrados');
select throws_ok($$select test_support.run('submit_word_search_selection', '{"startCell":12,"endCell":14}')$$, '55000', 'interaction_not_presented', 'No se puede seleccionar después del cierre');

select test_support.as_actor('owner');
set local role service_role;
select is((select private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('w', 40))->'answer' from test_support.runtime), '["abc","mno"]'::jsonb, 'La evaluación reconstruye la respuesta desde eventos');
select is((select (private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('w', 40))->>'incorrectAttempts')::integer from test_support.runtime), 1, 'La evaluación cuenta los fallos persistidos');
reset role;

select * from finish();
rollback;
