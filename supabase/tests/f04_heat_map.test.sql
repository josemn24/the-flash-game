-- F04 competitive Heat-map. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

insert into public.rooms (id, slug, title, description)
values (test_support.id('f04-room'), 'f04-room', 'F04', 'Heat-map');
insert into public.room_memberships (room_id, player_id, role, status)
values (test_support.id('f04-room'), test_support.id('owner'), 'owner', 'active');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (test_support.id('f04-season'), test_support.id('f04-room'), 'F04', 'active', now() - interval '1 hour', now() + interval '1 hour');

insert into private.question_definitions (id, slug, created_by_player_id)
values
  (test_support.id('f04-q-choice'), 'f04-choice', test_support.id('superadmin')),
  (test_support.id('f04-q-heat-map'), 'sbr-grand-canyon-heat-map', test_support.id('superadmin')),
  (test_support.id('f04-q-heat-map-timeout'), 'f04-heat-map-timeout', test_support.id('superadmin'));
insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values (test_support.id('f04-asset'), 'question-assets', 'question-assets/' || test_support.id('f04-asset')::text || '.jpg',
  'question-asset', 'ready', test_support.id('superadmin'), 'image/jpeg', 1, 1200, 800,
  'de188cf69cb899771872cc32cd304babd4dd64c483f8165f3766dd844db3aad0');

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
values
  (test_support.id('f04-qv-choice'), test_support.id('f04-q-choice'), 1, 1, 'draft', 'multiple-choice', 15000,
    '{"question":"¿Capital?","options":["Lisboa","Madrid"]}', test_support.id('superadmin')),
  (test_support.id('f04-qv-heat-map'), test_support.id('f04-q-heat-map'), 1, 2, 'draft', 'heat-map', 18000,
    jsonb_build_object('question','Marca aproximadamente dónde se encuentra el Gran Cañón.','targetLabel','Norte de Arizona',
      'surface',jsonb_build_object('assetId',test_support.id('f04-asset')::text,'alt','Mapa sin etiquetas de Estados Unidos','width',1200,'height',800,'fit','contain')),
    test_support.id('superadmin')),
  (test_support.id('f04-qv-heat-map-timeout'), test_support.id('f04-q-heat-map-timeout'), 1, 2, 'draft', 'heat-map', 18000,
    jsonb_build_object('question','Marca la ubicación.','targetLabel','Zona objetivo',
      'surface',jsonb_build_object('assetId',test_support.id('f04-asset')::text,'alt','Mapa de prueba','width',1200,'height',800)),
    test_support.id('superadmin'));
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (test_support.id('f04-qv-choice'), '{"correctAnswer":"Lisboa"}'),
  (test_support.id('f04-qv-heat-map'), jsonb_build_object('target',jsonb_build_object('x',0.38,'y',0.58),
    'fullCreditRadius',0.055,'toleranceRadius',0.18,'explanation','El Gran Cañón está en Arizona.')),
  (test_support.id('f04-qv-heat-map-timeout'), jsonb_build_object('target',jsonb_build_object('x',0.5,'y',0.5),
    'fullCreditRadius',0.05,'toleranceRadius',0.2,'explanation','Fixture de timeout.'));
update private.question_versions
set status = 'published', published_at = now()
where id in (test_support.id('f04-qv-choice'), test_support.id('f04-qv-heat-map'), test_support.id('f04-qv-heat-map-timeout'));

insert into private.challenge_definitions (id, slug, created_by_player_id)
values (test_support.id('f04-cd'), 'f04-heat-map', test_support.id('superadmin'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (test_support.id('f04-cv'), test_support.id('f04-cd'), 1, 1, 'draft', 'flash',
  'F04 Heat-map', 'Precisión espacial', 'Fixture F04', 100, '{}', test_support.id('superadmin'), null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('f04-item-choice'), test_support.id('f04-cv'), test_support.id('f04-qv-choice'), 1, 34, 1, '{}'),
  (test_support.id('f04-item-heat-map'), test_support.id('f04-cv'), test_support.id('f04-qv-heat-map'), 2, 33, 1, '{}'),
  (test_support.id('f04-item-timeout'), test_support.id('f04-cv'), test_support.id('f04-qv-heat-map-timeout'), 3, 33, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('f04-cv');
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('f04-sc'), test_support.id('f04-season'), test_support.id('f04-cv'), 99, 'open',
  now() - interval '1 hour', now() + interval '1 hour');

select ok(private.is_supported_flash_question(test_support.id('f04-qv-heat-map')), 'Heat-map v2 is a supported Flash question');
select ok(private.is_ready_question_asset(test_support.id('f04-asset')), 'F04 question asset is ready');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('f04-cv'))$$, 'Calendar accepts the mixed F04 publication');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('f04-sc')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', jsonb_build_object('answer', 'Lisboa'));
select test_support.run('record_evaluation', '{"status":"correct","points":34}');
select test_support.run('prepare_interaction');
select is((select state->>'challengeItemId' from test_support.runtime), test_support.id('f04-item-heat-map')::text, 'Prepare releases heat-map in order');
select is((select state->'publicPayload'->'surface'->>'assetId' from test_support.runtime), test_support.id('f04-asset')::text, 'Prepare returns only the private surface reference');
select ok((select not (state->'publicPayload' ? 'target') and not (state->'publicPayload' ? 'fullCreditRadius') and not (state->'publicPayload' ? 'toleranceRadius') from test_support.runtime), 'Prepare does not expose heat-map solution');
select test_support.run('receive_answer', jsonb_build_object('answer', jsonb_build_object('x',0.39,'y',0.57)));
select test_support.run('record_evaluation', '{"status":"partial","points":25}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', jsonb_build_object('answer', null));
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
select is((select last_result->>'status' from test_support.runtime), 'unanswered', 'Timeout without a heat-map marker yields zero');

reset role;
select * from finish();
rollback;
