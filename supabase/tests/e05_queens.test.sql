begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','e05-editorial','title','E05','subtitle','Queens','description','E05','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('slug','e05-choice','type','multiple-choice','payloadSchemaVersion',1,'timeLimitMs',15000,'points',50,
        'publicPayload',jsonb_build_object('question','¿Capital?','options',jsonb_build_array('Lisboa','Madrid')),
        'solutionPayload',jsonb_build_object('correctAnswer','Lisboa')),
      jsonb_build_object('slug','e05-queens','type','queens','payloadSchemaVersion',1,'timeLimitMs',60000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Coloca cinco coronas.',
          'grid',jsonb_build_object('rows',5,'columns',5),
          'regions',jsonb_build_array(0,0,0,1,1,2,0,1,1,1,2,2,1,3,1,2,3,3,3,3,2,4,3,3,3),
          'prefilledQueens',jsonb_build_array(2)),
        'solutionPayload',jsonb_build_object('solution',jsonb_build_array(2,9,10,18,21)))
    )))
$$, 'El validador acepta un Flash mixto con Queens');
select is(to_regclass('private.queens_placement_events_item_idx')::text, 'private.queens_placement_events_item_idx', 'Existe el índice principal de eventos Queens');
select ok((select relrowsecurity from pg_class where oid = 'private.queens_placement_events'::regclass), 'RLS está habilitado para los eventos Queens');
select ok(not has_table_privilege('service_role', 'private.queens_placement_events', 'SELECT'), 'service_role no lee los eventos Queens directamente');

insert into public.rooms(id, slug, title) values (test_support.id('e05-room'), 'e05-queens-room', 'Sala E05');
insert into public.room_memberships(room_id, player_id, role) values (test_support.id('e05-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e05-season'), test_support.id('e05-room'), 'Temporada E05', 'active', now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id) values (test_support.id('e05-q'), 'e05-queens', test_support.id('superadmin'));
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('e05-qv'), test_support.id('e05-q'), 1, 1, 'draft', 'queens', 60000,
  '{"question":"Coloca cinco coronas.","grid":{"rows":5,"columns":5},"regions":[0,0,0,1,1,2,0,1,1,1,2,2,1,3,1,2,3,3,3,3,2,4,3,3,3],"prefilledQueens":[2]}', test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e05-qv'), '{"solution":[2,9,10,18,21]}');
update private.question_versions set status = 'published', published_at = now() where id = test_support.id('e05-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id) values (test_support.id('e05-cd'), 'e05-queens-flash', test_support.id('superadmin'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('e05-cv'), test_support.id('e05-cd'), 1, 1, 'draft', 'flash', 'Flash Queens', 'Coronas', 'Prueba E05.', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values (test_support.id('e05-item'), test_support.id('e05-cv'), test_support.id('e05-qv'), 1, 100, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now() where id = test_support.id('e05-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e05-sc'), test_support.id('e05-season'), test_support.id('e05-cv'), 20, 'open', now() - interval '1 hour', now() + interval '1 hour');

select ok(private.is_supported_flash_question(test_support.id('e05-qv')), 'Queens válido es jugable en Flash');
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('e05-sc'), 'sessionToken', repeat('q', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%solution%'), 'Prepare no expone la solución Queens');
select is((select last_result->'progress'->'queens' from test_support.runtime), '[2]'::jsonb, 'El progreso empieza con la corona precolocada');
select throws_ok($$select test_support.run('receive_answer', '{"answer":{"queens":[2],"marks":[]}}')$$, '22023', 'queens_requires_placement_command', 'El dispatcher genérico exige el comando de colocación');
reset role;

select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":0,"action":"place"}')$$, 'Una colocación conflictiva crea un evento');
select is((select (last_result->>'conflicting')::boolean from test_support.runtime), true, 'El conflicto procede del servidor');
select is((select (last_result->>'penaltyApplied')::boolean from test_support.runtime), true, 'La colocación conflictiva aplica penalización');
select is((select count(*) from private.queens_placement_events), 1::bigint, 'El evento conflictivo queda persistido');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'La colocación es idempotente');
select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":0,"action":"remove"}')$$, 'Retirar una corona se acepta');
select is((select (last_result->>'penaltyApplied')::boolean from test_support.runtime), false, 'Retirar no penaliza');
select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":9,"action":"place"}')$$, 'La primera corona correcta se acepta');
select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":10,"action":"place"}')$$, 'La segunda corona correcta se acepta');
select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":18,"action":"place"}')$$, 'La tercera corona correcta se acepta');
select lives_ok($$select test_support.run('submit_queens_placement', '{"cell":21,"action":"place"}')$$, 'La última corona resuelve el tablero');
select is((select (last_result->>'terminal')::boolean from test_support.runtime), true, 'Completar Queens es terminal');
select is((select count(*) from private.answer_receipts), 1::bigint, 'La resolución crea una recepción final');

select test_support.as_actor('owner');
set local role service_role;
select is((select private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('q', 40))->'answer' from test_support.runtime), '{"queens":[2,9,10,18,21],"marks":[]}'::jsonb, 'La evaluación reconstruye el tablero y descarta marcas');
select is((select (private.read_evaluation_context((select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('q', 40))->>'incorrectAttempts')::integer from test_support.runtime), 1, 'La evaluación cuenta penalizaciones desde eventos');
reset role;
select test_support.run('record_evaluation', '{"status":"correct","points":95}');
select is((select count(*) from private.attempt_answers), 1::bigint, 'El resultado evaluado queda persistido');

select * from finish();
rollback;
