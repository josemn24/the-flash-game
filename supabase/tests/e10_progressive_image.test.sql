-- E10 competitive Progressive-image. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

insert into public.rooms (id, slug, title, description)
values (test_support.id('e10-room'), 'e10-room', 'E10', 'Progressive-image');
insert into public.room_memberships (room_id, player_id, role, status)
values (test_support.id('e10-room'), test_support.id('owner'), 'owner', 'active');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e10-season'), test_support.id('e10-room'), 'E10', 'active', now() - interval '1 hour', now() + interval '1 hour');

insert into private.question_definitions (id, slug, created_by_player_id)
values
  (test_support.id('e10-q-image'), 'e10-q-image', test_support.id('superadmin')),
  (test_support.id('e10-q-choice'), 'e10-q-choice', test_support.id('superadmin'));
insert into private.media_assets
  (id, bucket_id, object_path, kind, status, created_by_player_id, mime_type, byte_size, width, height, sha256)
values
  (test_support.id('e10-asset'), 'question-assets', 'question-assets/' || test_support.id('e10-asset')::text || '.png',
   'question-asset', 'ready', test_support.id('superadmin'), 'image/png', 1, 847, 566,
   'de188cf69cb899771872cc32cd304babd4bdd64c483f8165f3766dd844db3aad');
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms, public_payload, created_by_player_id)
values (
  test_support.id('e10-qv-choice'), test_support.id('e10-q-choice'), 1, 1, 'multiple-choice', 15000,
  '{"question":"¿Capital?","options":["Lisboa","Madrid"]}', test_support.id('superadmin')
);
insert into private.question_version_solutions (question_version_id, solution_payload)
values (test_support.id('e10-qv-choice'), '{"correctAnswer":"Lisboa"}');
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, type, time_limit_ms, public_payload, created_by_player_id)
values (
  test_support.id('e10-qv-image'), test_support.id('e10-q-image'), 1, 2, 'progressive-image', 20000,
  jsonb_build_object(
    'question', '¿Qué monumento aparece?',
    'surface', jsonb_build_object(
      'assetId', test_support.id('e10-asset')::text,
      'alt', 'Imagen progresivamente revelada de un monumento europeo',
      'width', 1024, 'height', 1024, 'fit', 'contain'
    ),
    'revealDurationMs', 12000,
    'answerLabel', '¿Qué aparece?', 'answerPlaceholder', 'Tu respuesta…'
  ),
  test_support.id('superadmin')
);
insert into private.question_version_solutions (question_version_id, solution_payload)
values (test_support.id('e10-qv-image'), jsonb_build_object(
  'correctAnswer', 'Torre Eiffel',
  'acceptedAnswers', jsonb_build_array('torre eiffel', 'eiffel tower'),
  'solutionAlt', 'La Torre Eiffel en París',
  'explanation', 'La imagen muestra la Torre Eiffel.'
));
update private.question_versions
set status = 'published', published_at = now()
where id in (test_support.id('e10-qv-choice'), test_support.id('e10-qv-image'));
insert into private.challenge_definitions (id, slug, created_by_player_id)
values (test_support.id('e10-cd'), 'e10-progressive-image', test_support.id('superadmin'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id, published_at)
values (test_support.id('e10-cv'), test_support.id('e10-cd'), 1, 1, 'draft', 'flash',
  'E10 Progressive-image', 'Imagen competitiva', 'Reloj iniciado por servidor.', 100, '{}',
  test_support.id('superadmin'), null);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e10-item-one'), test_support.id('e10-cv'), test_support.id('e10-qv-choice'), 1, 50, 1, '{}'),
  (test_support.id('e10-item-image'), test_support.id('e10-cv'), test_support.id('e10-qv-image'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('e10-cv');
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e10-sc'), test_support.id('e10-season'), test_support.id('e10-cv'), 99,
  'open', now() - interval '1 hour', now() + interval '1 hour');

select ok(private.is_supported_flash_question(test_support.id('e10-qv-image')), 'Progressive-image is a supported Flash question');
select ok(private.is_ready_question_asset(test_support.id('e10-asset')), 'E10 question asset is ready');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('e10-cv'))$$, 'Calendar accepts the mixed E10 publication');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('e10-sc')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', jsonb_build_object('answer', true));
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select test_support.run('prepare_interaction');

select is((select state->>'challengeItemId' from test_support.runtime), test_support.id('e10-item-image')::text,
  'Prepare releases the Progressive-image item in order');
select ok((select state->'lastResult' is null from test_support.runtime), 'No client-side result is trusted before receive_answer');
select is((select state->'publicPayload'->'surface'->>'assetId' from test_support.runtime), test_support.id('e10-asset')::text,
  'Database prepare returns the private asset reference');
select ok((select not (state->'publicPayload'->'surface' ? 'src') from test_support.runtime),
  'Database prepare never stores or returns a signed URL');
select ok((select not (state->'publicPayload' ? 'correctAnswer') from test_support.runtime), 'Prepare does not return the solution');
select ok((select not (state->'publicPayload' ? 'solutionAlt') from test_support.runtime), 'Prepare does not return solution alt text');
select ok((select state ? 'presentedAt' and state ? 'deadlineAt' from test_support.runtime), 'Prepare returns server presentation and deadline timestamps');

select test_support.run('receive_answer', jsonb_build_object('answer', '  EIFFEL TOWER  ', 'clientTimeUsedMs', 999999999));
select set_config('e10.time_used_ms', (select last_result->>'timeUsedMs' from test_support.runtime), true);
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select is((select last_result->>'status' from test_support.runtime), 'correct', 'Progressive-image accepts normalized answers');
select is((select (last_result->>'points')::integer from test_support.runtime), 50, 'Progressive-image awards the configured points');
select ok(current_setting('e10.time_used_ms')::integer < 20000, 'Evaluation uses server time instead of client time');

reset role;
select test_support.as_actor('superadmin');
set local role service_role;
select lives_ok($$select private.archive_question_asset_command(jsonb_build_object(
  'idempotencyKey', 'e10-archive-asset-001',
  'assetId', test_support.id('e10-asset'),
  'reason', 'Retirar asset de nuevas publicaciones'
))$$, 'Superadmin puede archivar el asset');
select is((select status from private.media_assets where id = test_support.id('e10-asset')), 'archived',
  'Archivar excluye el asset de nuevas publicaciones');
reset role;
select is((select count(*) from private.challenge_items where challenge_version_id = test_support.id('e10-cv')), 2::bigint,
  'E10 does not create auxiliary tables or items');
select * from finish();
rollback;
