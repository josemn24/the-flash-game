-- Narrative short-text inline and library references follow the editorial lifecycle.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select test_support.as_actor('superadmin');
set local role authenticated;
select set_config('s18.document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's18-narrative-short-text', 'title', 'Narrative short-text S18',
    'subtitle', 'Dos preguntas', 'description', 'Publicación editorial de Narrative.',
    'mode', 'narrative', 'configSchemaVersion', 1,
    'modeConfig', jsonb_build_object(
      'prologue', jsonb_build_object(
        'id', 's18-prologue', 'title', 'La señal',
        'blocks', jsonb_build_array(jsonb_build_object('type', 'narration', 'text', 'Comienza la expedición.'))
      ),
      'beats', jsonb_build_array(jsonb_build_object(
        'id', 's18-beat', 'title', 'Las respuestas',
        'steps', jsonb_build_array(
          jsonb_build_object('type', 'question', 'questionSlug', 's18-narrative-inline'),
          jsonb_build_object('type', 'question', 'questionSlug', 'commands-q-alphabet-1')
        )
      ))
    )
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 's18-narrative-inline', 'type', 'short-text', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 50,
      'modeConfig', jsonb_build_object('questionSlug', 's18-narrative-inline'),
      'publicPayload', jsonb_build_object('question', '¿Capital de Portugal?', 'answerPlaceholder', 'Ciudad'),
      'solutionPayload', jsonb_build_object('correctAnswer', 'Lisboa',
        'acceptedAnswers', jsonb_build_array('Lisboa'), 'explanation', 'Lisboa es la capital.')
    ),
    jsonb_build_object(
      'source', 'library', 'questionVersionId', test_support.id('qv-alphabet-1')::text,
      'points', 50, 'modeConfig', jsonb_build_object('questionSlug', 'commands-q-alphabet-1')
    )
  )
)::text, true);

select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's18-narrative-create', 'document', current_setting('s18.document')::jsonb,
  'reason', 'Preparar Narrative short-text'
))->>'status'), 'draft', 'Narrative accepts inline and library short-text questions in a draft');
reset role;

select set_config('s18.version_id', (
  select id::text from private.challenge_versions where title = 'Narrative short-text S18'
), true);
select is((select count(*) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s18.version_id')::uuid and question.type = 'short-text'), 2::bigint,
  'Narrative stores both short-text question sources');
select set_config('s18.expected_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s18.version_id')::uuid
), true);
select set_config('s18.updated_document', jsonb_set(current_setting('s18.document')::jsonb,
  '{challenge,title}', '"Narrative short-text S18 editado"'::jsonb)::text, true);

set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's18-narrative-update', 'challengeVersionId', current_setting('s18.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s18.expected_updated_at')::timestamptz,
  'document', current_setting('s18.updated_document')::jsonb, 'reason', 'Editar Narrative short-text'
))->>'title'), 'Narrative short-text S18 editado', 'A Narrative short-text draft can be edited');
reset role;

select set_config('s18.inline_question_version', (
  select question.id::text
  from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  join private.question_definitions definition on definition.id = question.question_definition_id
  where item.challenge_version_id = current_setting('s18.version_id')::uuid
    and definition.slug = 's18-narrative-inline'
), true);
select set_config('s18.inline_question_updated_at', (
  select updated_at::text from private.question_versions where id = current_setting('s18.inline_question_version')::uuid
), true);
set local role authenticated;
select lives_ok($$select public.publish_superadmin_question(jsonb_build_object(
  'idempotencyKey', 's18-narrative-publish-question',
  'questionVersionId', current_setting('s18.inline_question_version')::uuid,
  'expectedUpdatedAt', current_setting('s18.inline_question_updated_at')::timestamptz,
  'reason', 'Publicar pregunta Narrative short-text'
))$$, 'The inline Narrative short-text question can be published');
reset role;

select set_config('s18.expected_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s18.version_id')::uuid
), true);
set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's18-narrative-publish',
  'challengeVersionId', current_setting('s18.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s18.expected_updated_at')::timestamptz,
  'reason', 'Publicar Narrative short-text'
))->>'status'), 'published', 'Narrative with inline and library short-text questions can be published');
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's18-narrative-schedule', 'seasonId', test_support.id('season-narrative'),
  'challengeVersionId', current_setting('s18.version_id')::uuid, 'number', 2,
  'opensAt', now() + interval '1 day 1 hour', 'closesAt', now() + interval '1 day 2 hours',
  'reason', 'Programar Narrative short-text'
))->>'status'), 'scheduled', 'Narrative short-text passes the calendar eligibility check');
reset role;

select * from finish();
rollback;
