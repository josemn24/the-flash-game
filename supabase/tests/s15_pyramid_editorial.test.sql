-- S15 Pyramid publication requires seven ordered levels and supported evaluators.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select test_support.as_actor('superadmin');
set local role authenticated;
select set_config('s15.document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's15-pyramid-publish', 'title', 'La Pirámide S15', 'subtitle', 'Siete niveles',
    'description', 'Publicación de prueba S15', 'mode', 'pyramid',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', (
    select jsonb_agg(jsonb_build_object(
      'source', 'library', 'questionVersionId', test_support.id('qv-' || question_key),
      'points', points,
      'modeConfig', jsonb_build_object(
        'levelId', 'level-' || level_number,
        'label', 'Nivel ' || level_number,
        'briefing', jsonb_build_object(
          'title', 'Briefing ' || level_number,
          'format', 'Lógica',
          'description', 'Resuelve la prueba para ascender.'
        )
      )
    ) order by level_number)
    from (values
      (1, 'pyramid-1', 14), (2, 'pyramid-2', 14), (3, 'pyramid-3', 14),
      (4, 'pyramid-4', 14), (5, 'pyramid-5', 14), (6, 'pyramid-6', 15),
      (7, 'pyramid-7', 15)
    ) as levels(level_number, question_key, points)
  )
)::text, true);

reset role;
select is(private.is_valid_pyramid_level_config(
  '{"levelId":"level-1","label":"Nivel 1","briefing":{"title":"Inicio","format":"Lógica","description":"Resuelve el nivel."}}'::jsonb
), true, 'A bounded level config with a briefing is valid');
select is(private.is_valid_pyramid_level_config(
  '{"levelId":"level-1","label":"Nivel 1","briefing":{"title":"Inicio","format":"Lógica"}}'::jsonb
), false, 'A briefing missing its description is rejected');
set local role authenticated;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-editorial-six-levels',
  'document', current_setting('s15.document')::jsonb #- '{questions,6}',
  'reason', 'Pyramid must contain seven levels'
))$$, '22023', 'incomplete_content', 'Six levels cannot be drafted');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-editorial-duplicate-level',
  'document', jsonb_set(current_setting('s15.document')::jsonb,
    '{questions,1,modeConfig,levelId}', '"level-1"'::jsonb),
  'reason', 'Duplicate level ids'
))$$, '22023', 'invalid_content', 'Duplicate level ids are rejected');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-editorial-invalid-briefing',
  'document', jsonb_set(current_setting('s15.document')::jsonb,
    '{questions,0,modeConfig,briefing}', '{"title":"Inicio","format":"Lógica"}'::jsonb),
  'reason', 'Invalid briefing'
))$$, '22023', 'invalid_content', 'A level briefing must have all required fields');

select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-editorial-create', 'document', current_setting('s15.document')::jsonb,
  'reason', 'Preparar La Pirámide'
))->>'status'), 'draft', 'A valid seven-level Pyramid document can be drafted');
reset role;
select set_config('s15.version_id', (
  select id::text from private.challenge_versions where title = 'La Pirámide S15'
), true);
select set_config('s15.expected_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s15.version_id')::uuid
), true);
set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's15-editorial-publish',
  'challengeVersionId', current_setting('s15.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s15.expected_updated_at')::timestamptz,
  'reason', 'Publicar La Pirámide S15'
))->>'status'), 'published', 'A supported seven-level Pyramid can be published');
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's15-editorial-schedule', 'seasonId', test_support.id('season-pyramid'),
  'challengeVersionId', current_setting('s15.version_id')::uuid, 'number', 2,
  'opensAt', now() + interval '1 day 1 hour', 'closesAt', now() + interval '1 day 2 hours',
  'reason', 'Programar La Pirámide S15'
))->>'status'), 'scheduled', 'The calendar accepts a published Pyramid');

select set_config('s15.unsupported_document', jsonb_set(jsonb_set(jsonb_set(
  current_setting('s15.document')::jsonb,
  '{challenge,slug}', '"s15-pyramid-unevaluated-format"'::jsonb),
  '{challenge,title}', '"La Pirámide S15 formato no evaluado"'::jsonb),
  '{questions,0}',
  jsonb_build_object(
    'slug', 's15-pyramid-odd-one-out', 'type', 'odd-one-out', 'payloadSchemaVersion', 1,
    'timeLimitMs', 15000, 'points', 14,
    'publicPayload', jsonb_build_object('question', '¿Qué elemento no pertenece?', 'items', jsonb_build_array(
      jsonb_build_object('id', 'a', 'label', 'A'), jsonb_build_object('id', 'b', 'label', 'B'),
      jsonb_build_object('id', 'c', 'label', 'C'))),
    'solutionPayload', jsonb_build_object('correctAnswer', 'c', 'explanation', 'C no pertenece.'),
    'modeConfig', jsonb_build_object(
      'levelId', 'level-1', 'label', 'Nivel 1',
      'briefing', jsonb_build_object('title', 'Briefing 1', 'format', 'Texto', 'description', 'Resuelve el nivel.')
    )
  )
)::text, true);
select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-editorial-unsupported-create',
  'document', current_setting('s15.unsupported_document')::jsonb,
  'reason', 'Probar formato no disponible en el evaluador competitivo'
))->>'status'), 'draft', 'An unevaluated competitive format can exist in a draft');
reset role;
select set_config('s15.unsupported_version_id', (
  select id::text from private.challenge_versions where title = 'La Pirámide S15 formato no evaluado'
    and status = 'draft' order by created_at desc limit 1
), true);
select set_config('s15.unevaluated_version_id', (
  select question.id::text from private.question_versions question
  join private.question_definitions definition on definition.id = question.question_definition_id
  where definition.slug = 's15-pyramid-odd-one-out'
), true);
select set_config('s15.unevaluated_updated_at', (
  select updated_at::text from private.question_versions where id = current_setting('s15.unevaluated_version_id')::uuid
), true);
set local role authenticated;
select lives_ok($$select public.publish_superadmin_question(jsonb_build_object(
  'idempotencyKey', 's15-editorial-publish-unevaluated',
  'questionVersionId', current_setting('s15.unevaluated_version_id')::uuid,
  'expectedUpdatedAt', current_setting('s15.unevaluated_updated_at')::timestamptz,
  'reason', 'Publicar formato para validar el gate'
))$$, 'The unsupported question is otherwise publishable');
reset role;
select set_config('s15.unsupported_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s15.unsupported_version_id')::uuid
), true);
set local role authenticated;
select throws_ok($$select public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's15-editorial-unsupported-publish',
  'challengeVersionId', current_setting('s15.unsupported_version_id')::uuid,
  'expectedUpdatedAt', current_setting('s15.unsupported_updated_at')::timestamptz,
  'reason', 'No hay evaluación competitiva'
))$$, '22023', 'unsupported_question', 'Pyramid publication rejects a format without a server evaluator');

select test_support.as_actor('member');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-member-create', 'document', current_setting('s15.document')::jsonb,
  'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot create Pyramid content');
select throws_ok($$select public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's15-member-publish',
  'challengeVersionId', current_setting('s15.version_id')::uuid,
  'expectedUpdatedAt', now(), 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot publish Pyramid content');

select * from finish();
rollback;
