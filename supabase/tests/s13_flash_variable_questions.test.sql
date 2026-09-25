-- S13 variable Flash question count. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select set_config('s13.document_2', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's13-flash-two', 'title', 'Flash S13 dos', 'subtitle', 'Dos preguntas',
    'description', 'Contrato variable de Flash', 'mode', 'flash',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 's13-two-1', 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 50,
      'publicPayload', jsonb_build_object('category', 'Test', 'tags', '{}'::jsonb,
        'question', 'Pregunta 1', 'options', jsonb_build_array('A', 'B'), 'media', null, 'promptVisual', null),
      'solutionPayload', jsonb_build_object('correctAnswer', 'A')
    ),
    jsonb_build_object(
      'slug', 's13-two-2', 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 50,
      'publicPayload', jsonb_build_object('category', 'Test', 'tags', '{}'::jsonb,
        'question', 'Pregunta 2', 'options', jsonb_build_array('A', 'B'), 'media', null, 'promptVisual', null),
      'solutionPayload', jsonb_build_object('correctAnswer', 'A')
    )
  )
)::text, true);

select set_config('s13.document_5', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's13-flash-five', 'title', 'Flash S13 cinco', 'subtitle', 'Cinco preguntas',
    'description', 'Contrato variable de Flash', 'mode', 'flash',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', (
    select jsonb_agg(jsonb_build_object(
      'slug', format('s13-five-%s', number), 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 20,
      'publicPayload', jsonb_build_object('category', 'Test', 'tags', '{}'::jsonb,
        'question', format('Pregunta %s', number), 'options', jsonb_build_array('A', 'B'), 'media', null, 'promptVisual', null),
      'solutionPayload', jsonb_build_object('correctAnswer', 'A')
    ) order by number) from generate_series(1, 5) as series(number)
  )
)::text, true);

select set_config('s13.document_20', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's13-flash-twenty', 'title', 'Flash S13 veinte', 'subtitle', 'Veinte preguntas',
    'description', 'Contrato variable de Flash', 'mode', 'flash',
    'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', (
    select jsonb_agg(jsonb_build_object(
      'slug', format('s13-twenty-%s', number), 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 5,
      'publicPayload', jsonb_build_object('category', 'Test', 'tags', '{}'::jsonb,
        'question', format('Pregunta %s', number), 'options', jsonb_build_array('A', 'B'), 'media', null, 'promptVisual', null),
      'solutionPayload', jsonb_build_object('correctAnswer', 'A')
    ) order by number) from generate_series(1, 20) as series(number)
  )
)::text, true);

select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-invalid-count',
  'document', jsonb_set(current_setting('s13.document_20')::jsonb, '{questions}', '[]'::jsonb),
  'reason', 'Fuera de rango'
))$$, '22023', 'incomplete_content', 'A Flash with fewer than two questions is rejected');

select throws_ok($$select public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-invalid-total',
  'document', jsonb_set(current_setting('s13.document_5')::jsonb, '{questions,0,points}', '19'::jsonb),
  'reason', 'Suma incorrecta'
))$$, '22023', 'points_total_invalid', 'A Flash whose points do not sum to 100 is rejected');

select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-create-two', 'document', current_setting('s13.document_2')::jsonb,
  'reason', 'Crear borrador inicial'
))->>'questionCount'), '2', 'A two-question Flash remains supported');
reset role;
select set_config('s13.version_two', (select version.id::text
  from private.challenge_versions version
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where definition.slug = 's13-flash-two'), true);
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 2::bigint,
  'The initial draft contains two items');

select set_config('s13.updated_two', (select updated_at::text from private.challenge_versions where id = current_setting('s13.version_two')::uuid), true);
set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-update-five', 'challengeVersionId', current_setting('s13.version_two')::uuid,
  'expectedUpdatedAt', current_setting('s13.updated_two')::timestamptz,
  'document', current_setting('s13.document_5')::jsonb, 'reason', 'Ampliar a cinco preguntas'
))->>'questionCount'), '5', 'A draft can grow from two to five questions');
reset role;
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 5::bigint,
  'Growing a draft creates the additional challenge items');
select is((select sum(points) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 100::bigint,
  'The five-question draft still sums to 100 points');

select set_config('s13.updated_five', (select updated_at::text from private.challenge_versions where id = current_setting('s13.version_two')::uuid), true);
set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-update-twenty', 'challengeVersionId', current_setting('s13.version_two')::uuid,
  'expectedUpdatedAt', current_setting('s13.updated_five')::timestamptz,
  'document', current_setting('s13.document_20')::jsonb, 'reason', 'Ampliar a veinte preguntas'
))->>'questionCount'), '20', 'A draft can grow to twenty questions');
reset role;
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 20::bigint,
  'The twenty-question draft contains twenty items');
select is((select min(position) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 1,
  'The first question keeps position one');
select is((select max(position) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 20,
  'The last question receives position twenty');
select is((select sum(points) from private.challenge_items where challenge_version_id = current_setting('s13.version_two')::uuid), 100::bigint,
  'The twenty-question draft sums to 100 points');
select set_config('s13.question_versions', (
  select coalesce(jsonb_agg(jsonb_build_object('id', item.question_version_id, 'updatedAt', version.updated_at) order by item.position), '[]'::jsonb)
  from private.challenge_items item
  join private.question_versions version on version.id = item.question_version_id
  where item.challenge_version_id = current_setting('s13.version_two')::uuid
 )::text, true);
set local role authenticated;
do $$
declare
  item jsonb;
begin
  for item in select value from jsonb_array_elements(current_setting('s13.question_versions')::jsonb)
  loop
    perform public.publish_superadmin_question(jsonb_build_object(
      'idempotencyKey', 's13-publish-question-' || (item->>'id'),
      'questionVersionId', (item->>'id')::uuid,
      'expectedUpdatedAt', (item->>'updatedAt')::timestamptz,
      'reason', 'Publicar pregunta S13'
    ));
  end loop;
end;
$$;
reset role;

select set_config('s13.updated_twenty', (select updated_at::text from private.challenge_versions where id = current_setting('s13.version_two')::uuid), true);
set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's13-publish-twenty', 'challengeVersionId', current_setting('s13.version_two')::uuid,
  'expectedUpdatedAt', current_setting('s13.updated_twenty')::timestamptz, 'reason', 'Publicar veinte preguntas'
))->>'questionCount'), '20', 'A twenty-question Flash can be published');
reset role;
select is((select count(*) from private.question_versions question
  join private.challenge_items item on item.question_version_id = question.id
  where item.challenge_version_id = current_setting('s13.version_two')::uuid and question.status = 'published'), 20::bigint,
  'Publishing freezes all twenty question versions');
select lives_ok($$select private.assert_supported_calendar_content(current_setting('s13.version_two')::uuid)$$,
  'The calendar accepts a published twenty-question Flash');

select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-create-twenty',
  'document', jsonb_set(
    jsonb_set(current_setting('s13.document_20')::jsonb, '{challenge,slug}', '"s13-flash-reducible"'::jsonb),
    '{questions}', (
      select jsonb_agg(jsonb_set(value, '{slug}', to_jsonb(replace(value->>'slug', 's13-twenty', 's13-reducible'))) order by ordinality)
      from jsonb_array_elements(current_setting('s13.document_20')::jsonb->'questions') with ordinality
    )
  ),
  'reason', 'Crear borrador reducible'
))->>'questionCount'), '20', 'A second twenty-question draft can be created');
reset role;
select set_config('s13.version_reducible', (select version.id::text
  from private.challenge_versions version
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where definition.slug = 's13-flash-reducible'), true);
select set_config('s13.updated_reducible', (select updated_at::text from private.challenge_versions where id = current_setting('s13.version_reducible')::uuid), true);
set local role authenticated;
select is((public.update_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's13-reduce-two', 'challengeVersionId', current_setting('s13.version_reducible')::uuid,
  'expectedUpdatedAt', current_setting('s13.updated_reducible')::timestamptz,
  'document', jsonb_set(
    jsonb_set(current_setting('s13.document_2')::jsonb, '{challenge,slug}', '"s13-flash-reducible"'::jsonb),
    '{questions}', (
      select jsonb_agg(jsonb_set(value, '{slug}', to_jsonb(replace(value->>'slug', 's13-two', 's13-reducible'))) order by ordinality)
      from jsonb_array_elements(current_setting('s13.document_2')::jsonb->'questions') with ordinality
    )
  ), 'reason', 'Reducir a dos preguntas'
))->>'questionCount'), '2', 'A draft can shrink from twenty to two questions');
reset role;
select is((select count(*) from private.challenge_items where challenge_version_id = current_setting('s13.version_reducible')::uuid), 2::bigint,
  'Shrinking removes trailing challenge items');
select is((select count(*) from private.question_definitions where slug like 's13-reducible-%'), 2::bigint,
  'Shrinking removes trailing draft question definitions');
select is((select count(*) from private.question_versions question
  join private.challenge_items item on item.question_version_id = question.id
  where item.challenge_version_id = current_setting('s13.version_reducible')::uuid), 2::bigint,
  'Shrinking leaves only the retained question versions');

select * from finish();
rollback;
