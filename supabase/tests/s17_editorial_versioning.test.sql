-- S17 challenge correction/versioning boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.create_superadmin_challenge_revision(jsonb)', 'EXECUTE'),
  'Authenticated can create challenge corrections');
select ok(has_function_privilege('authenticated', 'public.archive_superadmin_challenge_version(jsonb)', 'EXECUTE'),
  'Authenticated can archive challenge versions');
select ok(has_function_privilege('authenticated', 'public.get_superadmin_challenge_version_comparison(uuid, uuid)', 'EXECUTE'),
  'Authenticated can compare challenge versions');
select ok(not has_function_privilege('anon', 'public.create_superadmin_challenge_revision(jsonb)', 'EXECUTE'),
  'Anonymous users cannot create challenge corrections');
select ok(not has_function_privilege('service_role', 'public.archive_superadmin_challenge_version(jsonb)', 'EXECUTE'),
  'service_role cannot use the application archive boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.get_superadmin_challenge_version_comparison(uuid, uuid)'::regprocedure), 'postgres',
  'Challenge comparison is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.create_superadmin_challenge_revision(jsonb)'::regprocedure),
  'Challenge correction clears search_path');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
reset role;

insert into private.question_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s17-question-one'), 's17-question-one', test_support.id('superadmin')),
  (test_support.id('s17-question-two'), 's17-question-two', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id
)
values
  (test_support.id('s17-question-version-one'), test_support.id('s17-question-one'), 1, 1, 'draft', 'true-false', 30000,
    jsonb_build_object('question', '¿La corrección conserva el historial?'), test_support.id('superadmin')),
  (test_support.id('s17-question-version-two'), test_support.id('s17-question-two'), 1, 1, 'draft', 'true-false', 30000,
    jsonb_build_object('question', '¿Las referencias publicadas son inmutables?'), test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (test_support.id('s17-question-version-one'), jsonb_build_object('correctAnswer', true)),
  (test_support.id('s17-question-version-two'), jsonb_build_object('correctAnswer', false));
update private.question_versions
set status = 'published', published_at = now()
where id in (test_support.id('s17-question-version-one'), test_support.id('s17-question-version-two'));
insert into private.challenge_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s17-challenge-flash'), 's17-challenge-flash', test_support.id('superadmin')),
  (test_support.id('s17-challenge-survival'), 's17-challenge-survival', test_support.id('superadmin')),
  (test_support.id('s17-challenge-pyramid'), 's17-challenge-pyramid', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id
)
values
  (test_support.id('s17-cv-flash'), test_support.id('s17-challenge-flash'), 1, 1, 'draft', 'flash',
    'Flash S17', 'Corrección', 'Fuente Flash S17', 100, '{}'::jsonb, test_support.id('superadmin')),
  (test_support.id('s17-cv-survival'), test_support.id('s17-challenge-survival'), 1, 1, 'draft', 'survival',
    'Survival S17', 'Corrección', 'Fuente Survival S17', 100, '{"lives":1}'::jsonb, test_support.id('superadmin')),
  (test_support.id('s17-cv-pyramid'), test_support.id('s17-challenge-pyramid'), 1, 1, 'draft', 'pyramid',
    'Pyramid S17', 'Corrección', 'Fuente Pyramid S17', 100, '{}'::jsonb, test_support.id('superadmin'));
insert into private.challenge_items(
  id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config
)
values
  (test_support.id('s17-item-flash-1'), test_support.id('s17-cv-flash'), test_support.id('s17-question-version-one'), 1, 50, 1, '{}'::jsonb),
  (test_support.id('s17-item-flash-2'), test_support.id('s17-cv-flash'), test_support.id('s17-question-version-two'), 2, 50, 1, '{}'::jsonb),
  (test_support.id('s17-item-survival-1'), test_support.id('s17-cv-survival'), test_support.id('s17-question-version-one'), 1, 50, 1, '{}'::jsonb),
  (test_support.id('s17-item-survival-2'), test_support.id('s17-cv-survival'), test_support.id('s17-question-version-two'), 2, 50, 1, '{}'::jsonb);
insert into private.challenge_items(
  id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config
)
select
  test_support.id('s17-item-pyramid-' || position), test_support.id('s17-cv-pyramid'),
  test_support.id('qv-pyramid-' || position), position,
  case when position < 6 then 14 else 15 end, 1,
  jsonb_build_object(
    'levelId', 'level-' || position,
    'label', 'Nivel ' || position,
    'briefing', jsonb_build_object(
      'title', 'Prueba ' || position,
      'format', 'Lógica',
      'description', 'Resuelve el nivel para avanzar.'
    )
  )
from generate_series(1, 7) position;
update private.challenge_versions
set status = 'published', published_at = now()
where id in (
  test_support.id('s17-cv-flash'), test_support.id('s17-cv-survival'), test_support.id('s17-cv-pyramid')
);

insert into public.rooms(id, slug, title)
values
  (test_support.id('s17-room-flash'), 's17-room-flash', 'Sala Flash S17'),
  (test_support.id('s17-room-survival'), 's17-room-survival', 'Sala Survival S17'),
  (test_support.id('s17-room-pyramid'), 's17-room-pyramid', 'Sala Pyramid S17');
insert into public.room_memberships(room_id, player_id, role)
values
  (test_support.id('s17-room-flash'), test_support.id('member'), 'member'),
  (test_support.id('s17-room-survival'), test_support.id('member'), 'member'),
  (test_support.id('s17-room-pyramid'), test_support.id('member'), 'member');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values
  (test_support.id('s17-season-flash'), test_support.id('s17-room-flash'), 'S17 Flash', 'active', now() - interval '1 day', now() + interval '2 days'),
  (test_support.id('s17-season-survival'), test_support.id('s17-room-survival'), 'S17 Survival', 'active', now() - interval '1 day', now() + interval '2 days'),
  (test_support.id('s17-season-pyramid'), test_support.id('s17-room-pyramid'), 'S17 Pyramid', 'active', now() - interval '1 day', now() + interval '2 days');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
  (test_support.id('s17-sc-flash'), test_support.id('s17-season-flash'), test_support.id('s17-cv-flash'), 1, 'open', now() - interval '1 hour', now() + interval '1 hour'),
  (test_support.id('s17-sc-survival'), test_support.id('s17-season-survival'), test_support.id('s17-cv-survival'), 1, 'open', now() - interval '1 hour', now() + interval '1 hour'),
  (test_support.id('s17-sc-pyramid'), test_support.id('s17-season-pyramid'), test_support.id('s17-cv-pyramid'), 1, 'open', now() - interval '1 hour', now() + interval '1 hour');

select set_config('s17.flash_updated_at', (select updated_at::text from private.challenge_versions where id = test_support.id('s17-cv-flash')), true);
select set_config('s17.survival_updated_at', (select updated_at::text from private.challenge_versions where id = test_support.id('s17-cv-survival')), true);
select set_config('s17.pyramid_updated_at', (select updated_at::text from private.challenge_versions where id = test_support.id('s17-cv-pyramid')), true);
select set_config('s17.alphabet_updated_at', (select updated_at::text from private.challenge_versions where id = test_support.id('cv-alphabet')), true);

select set_config('s17.alphabet_revision', (public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-alphabet-001',
  'sourceChallengeVersionId', test_support.id('cv-alphabet'),
  'reason', 'Corregir Alphabet piloto'
)) ->> 'challengeVersionId'), true);
select is((select status from private.challenge_versions where id = current_setting('s17.alphabet_revision')::uuid), 'draft',
  'Alphabet correction always starts as draft');
select is((select mode from private.challenge_versions where id = current_setting('s17.alphabet_revision')::uuid), 'alphabet',
  'Alphabet correction preserves its editorial mode');
select is((select global_time_limit_ms from private.challenge_versions where id = current_setting('s17.alphabet_revision')::uuid), 60000,
  'Alphabet correction preserves the global time limit');
select is((select mode_config->>'letter' from private.challenge_items where challenge_version_id = current_setting('s17.alphabet_revision')::uuid and position = 1), 'A',
  'Alphabet correction preserves item letters');
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s17.alphabet_revision')::uuid), 2::bigint,
  'Alphabet correction copies the complete item graph');
select is((public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-alphabet-001',
  'challengeVersionId', test_support.id('cv-alphabet'),
  'expectedUpdatedAt', current_setting('s17.alphabet_updated_at')::timestamptz,
  'reason', 'Retirar Alphabet anterior'
)) ->> 'status'), 'archived',
  'A published Alphabet version can be archived');
select is((public.get_superadmin_challenge_version_comparison(
  test_support.id('cv-alphabet'), current_setting('s17.alphabet_revision')::uuid
)->'from'->>'mode'), 'alphabet', 'Alphabet comparison identifies the source mode');
select is((public.get_superadmin_challenge_version_comparison(
  test_support.id('cv-alphabet'), current_setting('s17.alphabet_revision')::uuid
)->'to'->'items'->0->'modeConfig'->>'letter'), 'A',
  'Alphabet comparison preserves item mode configuration');

select set_config('s17.flash_revision', (public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-flash-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-flash'),
  'reason', 'Corregir Flash piloto'
)) ->> 'challengeVersionId'), true);
select set_config('s17.survival_revision', (public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-survival-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-survival'),
  'reason', 'Corregir Survival piloto'
)) ->> 'challengeVersionId'), true);
select set_config('s17.pyramid_revision', (public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-pyramid-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-pyramid'),
  'reason', 'Corregir Pyramid piloto'
)) ->> 'challengeVersionId'), true);

select is((select status from private.challenge_versions where id = current_setting('s17.flash_revision')::uuid), 'draft',
  'Flash correction always starts as draft');
select is((select status from private.challenge_versions where id = current_setting('s17.survival_revision')::uuid), 'draft',
  'Survival correction always starts as draft');
select is((select status from private.challenge_versions where id = current_setting('s17.pyramid_revision')::uuid), 'draft',
  'Pyramid correction always starts as draft');
select is((select version_number from private.challenge_versions where id = current_setting('s17.flash_revision')::uuid), 2,
  'Flash correction receives the next sequential version number');
select is((select version_number from private.challenge_versions where id = current_setting('s17.survival_revision')::uuid), 2,
  'Survival correction receives the next sequential version number');
select is((select version_number from private.challenge_versions where id = current_setting('s17.pyramid_revision')::uuid), 2,
  'Pyramid correction receives the next sequential version number');
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s17.flash_revision')::uuid), 2::bigint,
  'Flash correction copies the complete item graph');
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s17.survival_revision')::uuid), 2::bigint,
  'Survival correction copies the complete item graph');
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s17.pyramid_revision')::uuid), 7::bigint,
  'Pyramid correction copies all seven levels');
select is((select count(*) from private.challenge_items source
  join private.challenge_items copy on copy.position = source.position
  where source.challenge_version_id = test_support.id('s17-cv-flash')
    and copy.challenge_version_id = current_setting('s17.flash_revision')::uuid
    and source.question_version_id = copy.question_version_id), 2::bigint,
  'Flash correction preserves published question references by position');
select is((select count(*) from private.challenge_items source
  join private.challenge_items copy on copy.position = source.position
  where source.challenge_version_id = test_support.id('s17-cv-pyramid')
    and copy.challenge_version_id = current_setting('s17.pyramid_revision')::uuid
    and source.question_version_id = copy.question_version_id), 7::bigint,
  'Pyramid correction preserves published question references by position');
select is((select count(*) from private.challenge_items source
  join private.challenge_items copy on copy.position = source.position
  where source.challenge_version_id = test_support.id('s17-cv-flash')
    and copy.challenge_version_id = current_setting('s17.flash_revision')::uuid
    and source.id = copy.id), 0::bigint,
  'Corrections receive new challenge item identifiers');
select is((select status from private.challenge_versions where id = test_support.id('s17-cv-flash')), 'published',
  'Cloning does not mutate the original Flash version');
select is((select count(*) from private.audit_log where action = 'create_challenge_revision' and entity_id = test_support.id('s17-cv-flash')), 0::bigint,
  'Cloning does not append a mutation audit to the original version');
select is((select count(*) from private.audit_log where action = 'create_challenge_revision' and entity_id = current_setting('s17.flash_revision')::uuid), 1::bigint,
  'Cloning records one audit event on the new version');

select is((public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-flash-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-flash'),
  'reason', 'Corregir Flash piloto'
)) ->> 'challengeVersionId'), current_setting('s17.flash_revision'),
  'Identical correction retries return the original draft');
select throws_ok($$select public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-flash-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-survival'),
  'reason', 'Cambiar el origen'
))$$, '40001', 'idempotency_conflict',
  'Correction idempotency rejects a reused key with different input');
select throws_ok($$select public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-draft-001',
  'sourceChallengeVersionId', current_setting('s17.flash_revision')::uuid,
  'reason', 'No se puede clonar un borrador'
))$$, '55000', 'content_not_published',
  'A draft cannot be used as a correction source');
select set_config('s17.valid_document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 'commands-cd-flash', 'title', 'Flash corregido', 'subtitle', 'Piloto',
    'description', 'Documento válido para verificar la inmutabilidad', 'mode', 'flash',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 'commands-q-normal', 'type', 'true-false', 'payloadSchemaVersion', 1,
      'timeLimitMs', 60000, 'points', 50,
      'publicPayload', jsonb_build_object('question', '¿Prueba?'),
      'solutionPayload', jsonb_build_object('correctAnswer', true)
    ),
    jsonb_build_object(
      'slug', 'commands-q-normal-2', 'type', 'true-false', 'payloadSchemaVersion', 1,
      'timeLimitMs', 60000, 'points', 50,
      'publicPayload', jsonb_build_object('question', '¿Prueba dos?'),
      'solutionPayload', jsonb_build_object('correctAnswer', false)
    )
  )
)::text, true);
select throws_ok($$select public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's17-update-published-001',
  'challengeVersionId', test_support.id('s17-cv-flash'),
  'expectedUpdatedAt', current_setting('s17.flash_updated_at')::timestamptz,
  'document', current_setting('s17.valid_document')::jsonb,
  'reason', 'Editar publicado directamente'
))$$, '55000', 'content_not_draft',
  'Published challenge versions remain immutable');

select set_config('s17.flash_revision_updated_at', (select updated_at::text from private.challenge_versions where id = current_setting('s17.flash_revision')::uuid), true);
select set_config('s17.survival_revision_updated_at', (select updated_at::text from private.challenge_versions where id = current_setting('s17.survival_revision')::uuid), true);
select set_config('s17.pyramid_revision_updated_at', (select updated_at::text from private.challenge_versions where id = current_setting('s17.pyramid_revision')::uuid), true);
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's17-publish-flash-001',
  'challengeVersionId', current_setting('s17.flash_revision')::uuid,
  'expectedUpdatedAt', current_setting('s17.flash_revision_updated_at')::timestamptz,
  'reason', 'Publicar corrección Flash'
)) ->> 'status'), 'published', 'A corrected Flash version can be published');
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's17-publish-survival-001',
  'challengeVersionId', current_setting('s17.survival_revision')::uuid,
  'expectedUpdatedAt', current_setting('s17.survival_revision_updated_at')::timestamptz,
  'reason', 'Publicar corrección Survival'
)) ->> 'status'), 'published', 'A corrected Survival version can be published');
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's17-publish-pyramid-001',
  'challengeVersionId', current_setting('s17.pyramid_revision')::uuid,
  'expectedUpdatedAt', current_setting('s17.pyramid_revision_updated_at')::timestamptz,
  'reason', 'Publicar corrección Pyramid'
)) ->> 'status'), 'published', 'A corrected Pyramid version can be published');

select is((public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-flash-001',
  'challengeVersionId', test_support.id('s17-cv-flash'),
  'expectedUpdatedAt', current_setting('s17.flash_updated_at')::timestamptz,
  'reason', 'Retirar Flash anterior'
)) ->> 'status'), 'archived', 'A published Flash version can be archived');
select is((public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-survival-001',
  'challengeVersionId', test_support.id('s17-cv-survival'),
  'expectedUpdatedAt', current_setting('s17.survival_updated_at')::timestamptz,
  'reason', 'Retirar Survival anterior'
)) ->> 'status'), 'archived', 'A published Survival version can be archived');
select is((public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-pyramid-001',
  'challengeVersionId', test_support.id('s17-cv-pyramid'),
  'expectedUpdatedAt', current_setting('s17.pyramid_updated_at')::timestamptz,
  'reason', 'Retirar Pyramid anterior'
)) ->> 'status'), 'archived', 'A published Pyramid version can be archived');
select is((public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-flash-001',
  'challengeVersionId', test_support.id('s17-cv-flash'),
  'expectedUpdatedAt', current_setting('s17.flash_updated_at')::timestamptz,
  'reason', 'Retirar Flash anterior'
)) ->> 'status'), 'archived', 'Identical archive retries return the archived version');
select throws_ok($$select public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-flash-002',
  'challengeVersionId', test_support.id('s17-cv-flash'),
  'expectedUpdatedAt', current_setting('s17.flash_updated_at')::timestamptz,
  'reason', 'Archivar de nuevo'
))$$, '55000', 'content_not_published',
  'An archived version cannot be archived a second time');
select throws_ok($$select public.archive_superadmin_challenge_version(jsonb_build_object(
  'idempotencyKey', 's17-archive-survival-stale',
  'challengeVersionId', current_setting('s17.survival_revision')::uuid,
  'expectedUpdatedAt', current_setting('s17.survival_revision_updated_at')::timestamptz,
  'reason', 'Conflicto de concurrencia'
))$$, '40001', 'content_conflict',
  'Archiving uses optimistic concurrency');

select is((public.create_superadmin_challenge_revision(jsonb_build_object(
  'idempotencyKey', 's17-revise-archived-001',
  'sourceChallengeVersionId', test_support.id('s17-cv-flash'),
  'reason', 'Continuar corrección desde archivado'
)) ->> 'versionNumber'), '3',
  'An archived version can be used as the source of another correction');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
reset role;
select throws_ok($$select public.get_superadmin_challenge_version_comparison(
  test_support.id('s17-cv-flash'), current_setting('s17.flash_revision')::uuid
)$$, '42501', 'not_authorized',
  'Only a superadmin can compare editorial versions');
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
reset role;
select ok(not (public.get_superadmin_challenge_version_comparison(
  test_support.id('s17-cv-flash'), current_setting('s17.flash_revision')::uuid
)::text like '%solutionPayload%'),
  'Editorial comparison never exposes private solutions');
select is(jsonb_array_length(public.get_superadmin_challenge_version_comparison(
  test_support.id('s17-cv-pyramid'), current_setting('s17.pyramid_revision')::uuid
)->'from'->'items'), 7,
  'Pyramid comparison returns the complete editorial item list');
select is((public.get_superadmin_challenge_version_comparison(
  test_support.id('s17-cv-survival'), current_setting('s17.survival_revision')::uuid
)->'to'->'items'->0->>'questionVersionId'),
  (select question_version_id::text from private.challenge_items where challenge_version_id = test_support.id('s17-cv-survival') and position = 1),
  'Comparison preserves question references as editorial data');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
reset role;
select is((select count(*) from public.get_room_calendar('s17-room-flash')), 1::bigint,
  'Existing Flash publications remain visible after their version is archived');
select is((select count(*) from public.get_my_flash_challenge('s17-room-flash', test_support.id('s17-sc-flash'))), 2::bigint,
  'Existing Flash rooms still resolve archived challenge versions');
select is((select count(*) from public.get_my_survival_challenge('s17-room-survival', test_support.id('s17-sc-survival'))), 2::bigint,
  'Existing Survival rooms still resolve archived challenge versions');
select is((select count(*) from public.get_my_pyramid_challenge('s17-room-pyramid', test_support.id('s17-sc-pyramid'))), 7::bigint,
  'Existing Pyramid rooms still resolve archived challenge versions');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
reset role;
select throws_ok($$select public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's17-schedule-archived-001',
  'seasonId', test_support.id('s17-season-flash'),
  'challengeVersionId', test_support.id('s17-cv-flash'),
  'number', 2,
  'opensAt', now() + interval '1 hour',
  'closesAt', now() + interval '2 hours',
  'reason', 'No programar archivado'
))$$, '55000', 'content_not_published',
  'New publications reject archived challenge versions');

select * from finish();
rollback;
