-- S11 private editorial boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.get_superadmin_editorial_context()', 'EXECUTE'),
  'Authenticated can read the protected editorial context');
select ok(has_function_privilege('authenticated', 'public.create_superadmin_flash_draft(jsonb)', 'EXECUTE'),
  'Authenticated can create Flash drafts through the portal boundary');
select ok(has_function_privilege('authenticated', 'public.update_superadmin_flash_draft(jsonb)', 'EXECUTE'),
  'Authenticated can update Flash drafts through the portal boundary');
select ok(has_function_privilege('authenticated', 'public.publish_superadmin_flash(jsonb)', 'EXECUTE'),
  'Authenticated can publish Flash drafts through the portal boundary');
select ok(not has_function_privilege('anon', 'public.publish_superadmin_flash(jsonb)', 'EXECUTE'),
  'Anonymous users cannot publish editorial content');
select ok(not has_function_privilege('service_role', 'public.create_superadmin_flash_draft(jsonb)', 'EXECUTE'),
  'service_role cannot use the application editorial boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.publish_superadmin_flash(jsonb)'::regprocedure), 'postgres',
  'Editorial publication is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.publish_superadmin_flash(jsonb)'::regprocedure),
  'Editorial publication clears search_path');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select set_config('s11.document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's11-flash-001', 'title', 'Flash S11', 'subtitle', 'Dos preguntas',
    'description', 'Contenido editorial de prueba', 'mode', 'flash',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 's11-question-001', 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 50,
      'publicPayload', jsonb_build_object(
        'category', 'Cultura', 'tags', '{}'::jsonb, 'question', '¿Capital de Portugal?',
        'options', jsonb_build_array('Lisboa', 'Oporto', 'Braga'), 'media', null, 'promptVisual', null
      ),
      'solutionPayload', jsonb_build_object('correctAnswer', 'Lisboa', 'explanation', 'Lisboa es la capital.')
    ),
    jsonb_build_object(
      'slug', 's11-question-002', 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 12000, 'points', 50,
      'publicPayload', jsonb_build_object(
        'category', 'Ciencia', 'tags', '{}'::jsonb, 'question', '¿Qué planeta es rojo?',
        'options', jsonb_build_array('Marte', 'Venus', 'Júpiter'), 'media', null, 'promptVisual', null
      ),
      'solutionPayload', jsonb_build_object('correctAnswer', 'Marte', 'explanation', 'Marte.')
    )
  )
)::text, true);

select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-invalid-secret',
  'document', jsonb_set(current_setting('s11.document')::jsonb, '{questions,0,publicPayload,correctAnswer}', '"Lisboa"'::jsonb),
  'reason', 'Invalid payload'
))$$, '22023', 'invalid_public_payload', 'A solution cannot be embedded in the public payload');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-invalid-points',
  'document', jsonb_set(current_setting('s11.document')::jsonb, '{questions,1,points}', '40'::jsonb),
  'reason', 'Invalid points'
))$$, '22023', 'invalid_content', 'Unsupported point allocation is rejected');

select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-create-draft', 'document', current_setting('s11.document')::jsonb,
  'reason', 'Prepare S11 content'
))->>'status'), 'draft', 'A new Flash content graph starts as draft');
reset role;
select set_config('s11.version_id', (select id::text from private.challenge_versions where title = 'Flash S11'), true);
select is((select count(*) from private.challenge_versions where id = current_setting('s11.version_id')::uuid), 1::bigint,
  'Creating a draft persists one challenge version');
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s11.version_id')::uuid), 2::bigint,
  'Creating a draft persists exactly two challenge items');
select is((select sum(points) from private.challenge_items where challenge_version_id = current_setting('s11.version_id')::uuid), 100::bigint,
  'Flash items sum to 100 points');
select is((select count(*) from private.question_versions question join private.challenge_items item on item.question_version_id = question.id
  where item.challenge_version_id = current_setting('s11.version_id')::uuid and question.status = 'draft'), 2::bigint,
  'Questions remain drafts until publication');
select is((select count(*) from private.question_version_solutions solution join private.challenge_items item on item.question_version_id = solution.question_version_id
  where item.challenge_version_id = current_setting('s11.version_id')::uuid), 2::bigint,
  'Every draft question has a private solution');
select is((select count(*) from private.audit_log where action = 'create_flash_draft' and entity_id = current_setting('s11.version_id')::uuid), 1::bigint,
  'Draft creation writes one audit event');
select is((select after_payload ? 'documentHash' from private.audit_log where action = 'create_flash_draft' and entity_id = current_setting('s11.version_id')::uuid), true,
  'Draft audit stores a document hash');
select is((select after_payload ? 'solutionPayload' from private.audit_log where action = 'create_flash_draft' and entity_id = current_setting('s11.version_id')::uuid), false,
  'Draft audit does not store solution text');

set local role authenticated;
select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-create-draft', 'document', current_setting('s11.document')::jsonb,
  'reason', 'Prepare S11 content'
))->>'status'), 'draft', 'Identical creation retry returns the original result');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-create-draft',
  'document', jsonb_set(current_setting('s11.document')::jsonb, '{challenge,title}', '"Changed"'::jsonb),
  'reason', 'Prepare S11 content'
))$$, '40001', 'idempotency_conflict', 'A reused key with a different document is rejected');

reset role;
select set_config('s11.expected_updated_at', (select updated_at::text from private.challenge_versions where id = current_setting('s11.version_id')::uuid), true);
select set_config('s11.updated_document', jsonb_set(current_setting('s11.document')::jsonb, '{challenge,title}', '"Flash S11 editado"'::jsonb)::text, true);
set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-update-draft', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s11.expected_updated_at')::timestamptz,
  'document', current_setting('s11.updated_document')::jsonb, 'reason', 'Ajustar el contenido'
))->>'title'), 'Flash S11 editado', 'A draft can be updated with its expected timestamp');
reset role;
select is((select reason from private.audit_log where action = 'update_flash_draft' and entity_id = current_setting('s11.version_id')::uuid), 'Ajustar el contenido',
  'Draft updates audit their reason');
set local role authenticated;
select throws_ok($$select private.update_flash_draft_command(jsonb_build_object(
  'idempotencyKey', 's11-direct-private', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', now(), 'document', current_setting('s11.updated_document')::jsonb, 'reason', 'No direct access'
))$$, '42501', 'permission denied for function update_flash_draft_command', 'Private commands are not callable by clients');
reset role;

select set_config('s11.expected_updated_at', (select updated_at::text from private.challenge_versions where id = current_setting('s11.version_id')::uuid), true);
set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's11-publish', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', current_setting('s11.expected_updated_at')::timestamptz, 'reason', 'Publicar S11'
))->>'status'), 'published', 'A valid draft can be explicitly published');
reset role;
select is((select count(*) from private.question_versions question join private.challenge_items item on item.question_version_id = question.id
  where item.challenge_version_id = current_setting('s11.version_id')::uuid and question.status = 'published'), 2::bigint,
  'Publication freezes both question versions');
select is((select count(*) from public.scheduled_challenges where challenge_version_id = current_setting('s11.version_id')::uuid), 0::bigint,
  'Editorial publication does not create a scheduled challenge');
select is((select count(*) from private.audit_log where action = 'publish_flash' and entity_id = current_setting('s11.version_id')::uuid), 1::bigint,
  'Publication writes one audit event');

set local role authenticated;
select throws_ok($$select public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's11-publish-again', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', now(), 'reason', 'Publicar otra vez'
))$$, '55000', 'content_already_published', 'A published version cannot be published twice');
select throws_ok($$select public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-update-published', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', now(), 'document', current_setting('s11.updated_document')::jsonb, 'reason', 'Editar publicado'
))$$, '55000', 'content_not_draft', 'A published version cannot be edited');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.get_superadmin_editorial_context()$$, '42501', 'not_authorized',
  'A member cannot read the protected editorial context');
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-member-create', 'document', current_setting('s11.document')::jsonb, 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot create editorial content');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-owner'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's11-owner-publish', 'challengeVersionId', current_setting('s11.version_id')::uuid,
  'expectedUpdatedAt', now(), 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'An owner cannot publish editorial content');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-admin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-admin-create', 'document', current_setting('s11.document')::jsonb, 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'An admin cannot create editorial content');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-spectator'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-spectator-create', 'document', current_setting('s11.document')::jsonb, 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A spectator cannot create editorial content');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-outsider'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-outsider-create', 'document', current_setting('s11.document')::jsonb, 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'An outsider cannot create editorial content');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'role', 'anon', 'is_anonymous', true
)::text, true);
set local role anon;
select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's11-anon-create', 'document', current_setting('s11.document')::jsonb, 'reason', 'Forbidden'
))$$, '42501', 'permission denied for function create_superadmin_flash_draft', 'Anonymous users cannot create editorial content');
reset role;

select * from finish();
rollback;
