-- F03 competitive Estimation. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

insert into public.rooms (id, slug, title, description)
values (test_support.id('f03-room'), 'f03-room', 'F03', 'Estimation');
insert into public.room_memberships (room_id, player_id, role, status)
values (test_support.id('f03-room'), test_support.id('owner'), 'owner', 'active');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (test_support.id('f03-season'), test_support.id('f03-room'), 'F03', 'active', now() - interval '1 hour', now() + interval '1 hour');

insert into private.question_definitions (id, slug, created_by_player_id)
values
  (test_support.id('f03-q-choice'), 'f03-choice', test_support.id('superadmin')),
  (test_support.id('f03-q-estimation'), 'f03-estimation', test_support.id('superadmin')),
  (test_support.id('f03-q-estimation-timeout'), 'f03-estimation-timeout', test_support.id('superadmin'));
insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values (test_support.id('f03-asset'), 'question-assets', 'question-assets/' || test_support.id('f03-asset')::text || '.png',
  'question-asset', 'ready', test_support.id('superadmin'), 'image/png', 1, 640, 360,
  'de188cf69cb899771872cc32cd304babd4dd64c483f8165f3766dd844db3aad0');

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values
  (test_support.id('f03-qv-choice'), test_support.id('f03-q-choice'), 1, 1, 'draft', 'multiple-choice', 15000,
    '{"question":"¿Capital?","options":["Lisboa","Madrid"]}', test_support.id('superadmin')),
  (test_support.id('f03-qv-estimation'), test_support.id('f03-q-estimation'), 1, 2, 'draft', 'estimation', 22000,
    jsonb_build_object('question','¿Cuál es la velocidad media?','min',10,'max',60,'step',1,'initialValue',30,'unit','km/h',
      'media',jsonb_build_object('type','image','assetId',test_support.id('f03-asset')::text,'alt','Carrera','width',640,'height',360)),
    test_support.id('superadmin')),
  (test_support.id('f03-qv-estimation-timeout'), test_support.id('f03-q-estimation-timeout'), 1, 2, 'draft', 'estimation', 22000,
    jsonb_build_object('question','¿Cuántos kilómetros?','min',0,'max',100,'step',5,'initialValue',50,'unit','km','media',null),
    test_support.id('superadmin'));
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (test_support.id('f03-qv-choice'), '{"correctAnswer":"Lisboa"}'),
  (test_support.id('f03-qv-estimation'), '{"correctAnswer":36,"tolerance":18,"explanation":"40 minutos son dos tercios de hora."}'),
  (test_support.id('f03-qv-estimation-timeout'), '{"correctAnswer":50,"tolerance":20,"explanation":"Fixture de timeout."}');
update private.question_versions
set status = 'published', published_at = now()
where id in (
  test_support.id('f03-qv-choice'),
  test_support.id('f03-qv-estimation'),
  test_support.id('f03-qv-estimation-timeout')
);

insert into private.challenge_definitions (id, slug, created_by_player_id)
values (test_support.id('f03-cd'), 'f03-estimation', test_support.id('superadmin'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (test_support.id('f03-cv'), test_support.id('f03-cd'), 1, 1, 'draft', 'flash',
  'F03 Estimation', 'Estimación competitiva', 'Fixture F03', 100, '{}', test_support.id('superadmin'), null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('f03-item-choice'), test_support.id('f03-cv'), test_support.id('f03-qv-choice'), 1, 34, 1, '{}'),
  (test_support.id('f03-item-estimation'), test_support.id('f03-cv'), test_support.id('f03-qv-estimation'), 2, 33, 1, '{}'),
  (test_support.id('f03-item-timeout'), test_support.id('f03-cv'), test_support.id('f03-qv-estimation-timeout'), 3, 33, 1, '{}');
update private.challenge_versions
set status = 'published', published_at = now()
where id = test_support.id('f03-cv');
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('f03-sc'), test_support.id('f03-season'), test_support.id('f03-cv'), 99, 'open', now() - interval '1 hour', now() + interval '1 hour');

select ok(private.is_supported_flash_question(test_support.id('f03-qv-estimation')), 'Estimation v2 is a supported Flash question');
select ok(private.is_ready_question_asset(test_support.id('f03-asset')), 'F03 question asset is ready');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('f03-cv'))$$, 'Calendar accepts the mixed F03 publication');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','f03-invalid-grid','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(jsonb_build_object(
      'slug','f03-invalid-grid','type','estimation','payloadSchemaVersion',2,'timeLimitMs',12000,'points',100,
      'publicPayload',jsonb_build_object('question','Estimación','tags','{}'::jsonb,'min',0,'max',100,'step',5,'initialValue',12,'unit','km','media',null),
      'solutionPayload',jsonb_build_object('correctAnswer',50,'tolerance',10)
    ), jsonb_build_object(
      'slug','f03-valid-second','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',1,
      'publicPayload',jsonb_build_object('question','Válida'),
      'solutionPayload',jsonb_build_object('correctAnswer',true)
    ))
  ))
$$, '22023', 'invalid_public_payload', 'Rechaza una cuadrícula incompatible');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','f03-invalid-solution','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(jsonb_build_object(
      'slug','f03-invalid-solution','type','estimation','payloadSchemaVersion',2,'timeLimitMs',12000,'points',100,
      'publicPayload',jsonb_build_object('question','Estimación','tags','{}'::jsonb,'min',0,'max',100,'step',5,'initialValue',50,'unit','km','media',null),
      'solutionPayload',jsonb_build_object('correctAnswer',101,'tolerance',10)
    ), jsonb_build_object(
      'slug','f03-valid-second','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',1,
      'publicPayload',jsonb_build_object('question','Válida'),
      'solutionPayload',jsonb_build_object('correctAnswer',true)
    ))
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza una solución fuera de rango');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','f03-invalid-tolerance','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(jsonb_build_object(
      'slug','f03-invalid-tolerance','type','estimation','payloadSchemaVersion',2,'timeLimitMs',12000,'points',100,
      'publicPayload',jsonb_build_object('question','Estimación','tags','{}'::jsonb,'min',0,'max',100,'step',5,'initialValue',50,'unit','km','media',null),
      'solutionPayload',jsonb_build_object('correctAnswer',50,'tolerance',-1)
    ), jsonb_build_object(
      'slug','f03-valid-second','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',1,
      'publicPayload',jsonb_build_object('question','Válida'),
      'solutionPayload',jsonb_build_object('correctAnswer',true)
    ))
  ))
$$, '22023', 'invalid_solution_payload', 'Rechaza una tolerancia negativa');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object('slug','f03-public-secret','title','Inválido','subtitle','','description','','mode','flash','configSchemaVersion',1,'modeConfig','{}'::jsonb),
    'questions', jsonb_build_array(jsonb_build_object(
      'slug','f03-public-secret','type','estimation','payloadSchemaVersion',2,'timeLimitMs',12000,'points',100,
      'publicPayload',jsonb_build_object('question','Estimación','tags','{}'::jsonb,'min',0,'max',100,'step',5,'initialValue',50,'unit','km','media',null,'correctAnswer',50),
      'solutionPayload',jsonb_build_object('correctAnswer',50,'tolerance',10)
    ), jsonb_build_object(
      'slug','f03-valid-second','type','true-false','payloadSchemaVersion',1,'timeLimitMs',12000,'points',1,
      'publicPayload',jsonb_build_object('question','Válida'),
      'solutionPayload',jsonb_build_object('correctAnswer',true)
    ))
  ))
$$, '22023', 'invalid_public_payload', 'Rechaza secretos en publicPayload');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('f03-sc')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', jsonb_build_object('answer', 'Lisboa'));
select test_support.run('record_evaluation', '{"status":"correct","points":34}');
select test_support.run('prepare_interaction');
select is((select state->>'challengeItemId' from test_support.runtime), test_support.id('f03-item-estimation')::text, 'Prepare releases estimation in order');
select is((select state->'publicPayload'->'media'->>'assetId' from test_support.runtime), test_support.id('f03-asset')::text, 'Prepare returns only the private asset reference');
select ok((select not (state->'publicPayload' ? 'correctAnswer') and not (state->'publicPayload' ? 'tolerance') from test_support.runtime), 'Prepare does not expose estimation solution');
select test_support.run('receive_answer', jsonb_build_object('answer', 45));
select test_support.run('record_evaluation', '{"status":"partial","points":20}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', jsonb_build_object('answer', null));
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
select is((select last_result->>'status' from test_support.runtime), 'unanswered', 'Passing an estimation without an answer yields zero');

reset role;
select * from finish();
rollback;
