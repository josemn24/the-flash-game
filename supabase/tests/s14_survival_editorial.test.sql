-- S14 editorial and calendar boundaries for Survival mode.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select set_config('s14.document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's14-survival-publish', 'title', 'Supervivencia S14', 'subtitle', 'Dos preguntas',
    'description', 'Publicación de prueba S14', 'mode', 'survival',
    'configSchemaVersion', 1, 'modeConfig', jsonb_build_object('lives', 1)
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 's14-survival-q1', 'type', 'short-text', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 50,
      'publicPayload', jsonb_build_object('question', '¿Cuál es la capital de Portugal?',
        'answerPlaceholder', 'Ciudad'),
      'solutionPayload', jsonb_build_object('correctAnswer', 'Lisboa',
        'acceptedAnswers', jsonb_build_array('Lisboa'), 'explanation', 'Lisboa es la capital.')
    ),
    jsonb_build_object(
      'source', 'library', 'questionVersionId', test_support.id('qv-alphabet-1')::text,
      'points', 50, 'modeConfig', '{}'::jsonb
    )
  )
)::text, true);

select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-editorial-lives-zero',
  'document', jsonb_set(current_setting('s14.document')::jsonb, '{challenge,modeConfig,lives}', '0'::jsonb),
  'reason', 'Invalid lives'
))$$, '22023', 'invalid_content', 'Zero lives are rejected');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-editorial-lives-too-many',
  'document', jsonb_set(current_setting('s14.document')::jsonb, '{challenge,modeConfig,lives}', '3'::jsonb),
  'reason', 'Too many lives'
))$$, '22023', 'invalid_content', 'Lives cannot exceed the question count');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-editorial-extra-config',
  'document', jsonb_set(current_setting('s14.document')::jsonb, '{challenge,modeConfig}', '{"lives":1,"other":true}'::jsonb),
  'reason', 'Invalid config'
))$$, '22023', 'invalid_content', 'Survival accepts only its lives mode configuration');
select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-editorial-create', 'document', current_setting('s14.document')::jsonb,
  'reason', 'Preparar Survival'
))->>'status'), 'draft', 'A valid Survival document can be drafted');
reset role;
select set_config('s14.version_id', (
  select id::text from private.challenge_versions where title = 'Supervivencia S14'
), true);
select is((select count(*) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s14.version_id')::uuid and question.type = 'short-text'), 2::bigint,
  'Survival persists both inline and library short-text items');
select set_config('s14.expected_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s14.version_id')::uuid
), true);
select set_config('s14.updated_document', jsonb_set(current_setting('s14.document')::jsonb,
  '{challenge,title}', '"Supervivencia S14 editada"'::jsonb)::text, true);
set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-editorial-update', 'challengeVersionId', current_setting('s14.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s14.expected_updated_at')::timestamptz,
  'document', current_setting('s14.updated_document')::jsonb, 'reason', 'Editar Survival short-text'
))->>'title'), 'Supervivencia S14 editada', 'A Survival short-text draft can be edited');
reset role;
select set_config('s14.question_versions', (
  select coalesce(jsonb_agg(jsonb_build_object('id', item.question_version_id, 'updatedAt', question.updated_at) order by item.position), '[]'::jsonb)
  from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s14.version_id')::uuid and question.status = 'draft'
)::text, true);

set local role authenticated;
do $$
declare
  item jsonb;
begin
  for item in select value from jsonb_array_elements(current_setting('s14.question_versions')::jsonb)
  loop
    perform public.publish_superadmin_question(jsonb_build_object(
      'idempotencyKey', 's14-publish-question-' || (item->>'id'),
      'questionVersionId', (item->>'id')::uuid,
      'expectedUpdatedAt', (item->>'updatedAt')::timestamptz,
      'reason', 'Publicar pregunta de Supervivencia S14'
    ));
  end loop;
end;
$$;
reset role;
select is((select mode_config from private.challenge_versions where id = current_setting('s14.version_id')::uuid), '{"lives": 1}'::jsonb,
  'The published graph retains its initial lives configuration');
select set_config('s14.expected_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s14.version_id')::uuid
), true);

set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's14-editorial-publish', 'challengeVersionId', current_setting('s14.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s14.expected_updated_at')::timestamptz,
  'reason', 'Publicar Supervivencia S14'
))->>'status'), 'published', 'A valid Survival challenge can be published');
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's14-editorial-schedule', 'seasonId', test_support.id('season-survival'),
  'challengeVersionId', current_setting('s14.version_id')::uuid, 'number', 2,
  'opensAt', now() + interval '1 day 1 hour', 'closesAt', now() + interval '1 day 2 hours',
  'reason', 'Programar Supervivencia S14'
))->>'status'), 'scheduled', 'The calendar accepts a published Survival challenge');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's14-member-create', 'document', current_setting('s14.document')::jsonb,
  'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot create Survival content');
select throws_ok($$select public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's14-member-publish', 'challengeVersionId', current_setting('s14.version_id')::uuid,
  'expectedUpdatedAt', now(), 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot publish Survival content');
reset role;

select * from finish();
rollback;
