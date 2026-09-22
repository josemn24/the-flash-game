begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f16-editorial','title','Zip','subtitle','F16','description','Zip','mode','flash',
      'configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','f16-zip-one','type','zip','payloadSchemaVersion',1,'timeLimitMs',35000,'points',50,
        'publicPayload',jsonb_build_object(
          'category','Lógica espacial','tags','{}'::jsonb,
          'question','Une los números y cubre todas las celdas.',
          'grid',jsonb_build_object('rows',5,'columns',5),
          'checkpoints',jsonb_build_array(
            jsonb_build_object('value',1,'cell',0), jsonb_build_object('value',2,'cell',4),
            jsonb_build_object('value',3,'cell',5), jsonb_build_object('value',4,'cell',14),
            jsonb_build_object('value',5,'cell',15), jsonb_build_object('value',6,'cell',24))),
        'solutionPayload',jsonb_build_object(
          'solution',jsonb_build_array(0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24),
          'explanation','Recorrido serpenteante.')),
      jsonb_build_object(
        'slug','f16-zip-two','type','zip','payloadSchemaVersion',1,'timeLimitMs',35000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Une los números y cubre todas las celdas.',
          'grid',jsonb_build_object('rows',5,'columns',5),
          'checkpoints',jsonb_build_array(
            jsonb_build_object('value',1,'cell',0), jsonb_build_object('value',2,'cell',4),
            jsonb_build_object('value',3,'cell',5), jsonb_build_object('value',4,'cell',14),
            jsonb_build_object('value',5,'cell',15), jsonb_build_object('value',6,'cell',24))),
        'solutionPayload',jsonb_build_object(
          'solution',jsonb_build_array(0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24)))
    )
  ))
$$, 'Acepta Zip v1 con solución privada y payload público mínimo');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug','f16-invalid-public','title','Zip','subtitle','','description','','mode','flash',
      'configSchemaVersion',1,'modeConfig','{}'::jsonb
    ),
    'questions', jsonb_build_array(
      jsonb_build_object(
        'slug','f16-invalid-public-one','type','zip','payloadSchemaVersion',1,'timeLimitMs',35000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Zip','solution',jsonb_build_array(0,1,2),
          'grid',jsonb_build_object('rows',5,'columns',5),
          'checkpoints',jsonb_build_array(jsonb_build_object('value',1,'cell',0),jsonb_build_object('value',2,'cell',24))),
        'solutionPayload',jsonb_build_object('solution',jsonb_build_array(0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24))),
      jsonb_build_object(
        'slug','f16-invalid-public-two','type','zip','payloadSchemaVersion',1,'timeLimitMs',35000,'points',50,
        'publicPayload',jsonb_build_object(
          'question','Zip','grid',jsonb_build_object('rows',5,'columns',5),
          'checkpoints',jsonb_build_array(jsonb_build_object('value',1,'cell',0),jsonb_build_object('value',2,'cell',24))),
        'solutionPayload',jsonb_build_object('solution',jsonb_build_array(0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24)))
    )
  ))
$$, '22023', 'invalid_public_payload', 'Rechaza solution en publicPayload y soluciones no únicas');

select ok(to_regprocedure('private.zip_content_valid(jsonb,jsonb)') is not null,
  'El helper SQL privado de Zip existe');
select ok(not has_function_privilege('anon', 'private.zip_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'El navegador no puede ejecutar el validador privado');
select ok(to_regclass('private.zip_selection_events') is null,
  'Zip no crea una tabla de eventos por movimiento');

insert into public.rooms(id, slug, title)
values (test_support.id('f16-room'), 'f16-zip-room', 'Sala F16 Zip');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('f16-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('f16-season'), test_support.id('f16-room'), 'F16', 'active', now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('f16-q'), 'f16-zip', test_support.id('superadmin'));
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('f16-qv'), test_support.id('f16-q'), 1, 1, 'draft', 'zip', 35000,
  '{"question":"Zip","grid":{"rows":5,"columns":5},"checkpoints":[{"value":1,"cell":0},{"value":2,"cell":4},{"value":3,"cell":5},{"value":4,"cell":14},{"value":5,"cell":15},{"value":6,"cell":24}]}',
  test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('f16-qv'), '{"solution":[0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24],"explanation":"Recorrido serpenteante."}');
update private.question_versions set status = 'published', published_at = now()
where id = test_support.id('f16-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('f16-cd'), 'f16-zip-flash', test_support.id('superadmin'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version, status, mode, title, max_score, mode_config, created_by_player_id)
values (test_support.id('f16-cv'), test_support.id('f16-cd'), 1, 1, 'draft', 'flash', 'F16 Zip', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values (test_support.id('f16-item'), test_support.id('f16-cv'), test_support.id('f16-qv'), 1, 100, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('f16-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('f16-sc'), test_support.id('f16-season'), test_support.id('f16-cv'), 1, 'open', now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('f16-sc'), 'sessionToken', repeat('z', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%solution%'),
  'Prepare no expone la solución privada de Zip');

select lives_ok($$select test_support.run('receive_answer', '{"answer":{"path":[0,1,2]}}')$$,
  'El dispatcher genérico acepta un recorrido parcial como respuesta');
select test_support.run('record_evaluation', '{"status":"partial","points":0,"resultDetails":{"type":"zip","coveredCells":3,"reachedCheckpoint":1,"completed":false}}');
select is((select (last_result->>'lockVersion')::bigint from test_support.runtime), 4::bigint,
  'La evaluación del recorrido parcial avanza la versión de bloqueo');
select is((select result.status from private.attempt_answers result where result.receipt_id = (select (state->>'receiptId')::uuid from test_support.runtime)), 'partial',
  'El recorrido parcial conserva el estado de evaluación');
select is((select result.points from private.attempt_answers result where result.receipt_id = (select (state->>'receiptId')::uuid from test_support.runtime)), 0,
  'El recorrido parcial no puntúa');
select ok((select result.result_details->>'coveredCells' from private.attempt_answers result where result.receipt_id = (select (state->>'receiptId')::uuid from test_support.runtime)) = '3',
  'La evaluación conserva las métricas parciales');
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'La respuesta genérica de Zip es idempotente');

select * from finish();
rollback;
