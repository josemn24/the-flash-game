-- S15 format slices: server-evaluated formats share the existing editorial and admission gates.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select test_support.as_actor('superadmin');
select set_config('s15.mixed_pyramid_document', jsonb_build_object(
  'challenge', jsonb_build_object(
    'slug', 's15-pyramid-seven-formats', 'title', 'Pirámide con siete formatos',
    'subtitle', 'Slices competitivas', 'description', 'Prueba los formatos incorporados.',
    'mode', 'pyramid', 'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb
  ),
  'questions', jsonb_build_array(
    jsonb_build_object(
      'slug', 's15-format-true-false', 'type', 'true-false', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 14,
      'publicPayload', jsonb_build_object('question', 'El agua se congela a 0 °C.'),
      'solutionPayload', jsonb_build_object('correctAnswer', true, 'explanation', 'A presión normal, sí.'),
      'modeConfig', jsonb_build_object('levelId', 'level-1', 'label', 'Nivel 1',
        'briefing', jsonb_build_object('title', 'Briefing 1', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-ordering', 'type', 'ordering', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 14,
      'publicPayload', jsonb_build_object('question', 'Ordena las letras.', 'items', jsonb_build_array('A', 'C', 'B')),
      'solutionPayload', jsonb_build_object('correctOrder', jsonb_build_array('A', 'B', 'C'), 'explanation', 'Orden alfabético.'),
      'modeConfig', jsonb_build_object('levelId', 'level-2', 'label', 'Nivel 2',
        'briefing', jsonb_build_object('title', 'Briefing 2', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-classification', 'type', 'classification', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 14,
      'publicPayload', jsonb_build_object('question', 'Clasifica.',
        'items', jsonb_build_array(jsonb_build_object('label', 'Gato'), jsonb_build_object('label', 'Rosa')),
        'categories', jsonb_build_array('Animal', 'Planta')),
      'solutionPayload', jsonb_build_object('categoriesByItem', jsonb_build_object('Gato', 'Animal', 'Rosa', 'Planta'), 'explanation', 'Clasificación completa.'),
      'modeConfig', jsonb_build_object('levelId', 'level-3', 'label', 'Nivel 3',
        'briefing', jsonb_build_object('title', 'Briefing 3', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-logic-matrix', 'type', 'logic-matrix', 'payloadSchemaVersion', 1,
      'timeLimitMs', 15000, 'points', 14,
      'publicPayload', jsonb_build_object('question', '¿Qué pieza completa la matriz?',
        'pieces', jsonb_build_array(
          jsonb_build_object('id', 'a', 'symbol', 'A', 'label', 'Pieza A'),
          jsonb_build_object('id', 'b', 'symbol', 'B', 'label', 'Pieza B'),
          jsonb_build_object('id', 'c', 'symbol', 'C', 'label', 'Pieza C'),
          jsonb_build_object('id', 'd', 'symbol', 'D', 'label', 'Pieza D')),
        'cells', jsonb_build_array('a', 'b', 'c', 'b', 'c', 'a', 'c', 'a', null),
        'optionIds', jsonb_build_array('d', 'a', 'b', 'c'), 'showPieceLabels', true),
      'solutionPayload', jsonb_build_object('correctOptionId', 'd', 'explanation', 'La pieza D completa el patrón.'),
      'modeConfig', jsonb_build_object('levelId', 'level-4', 'label', 'Nivel 4',
        'briefing', jsonb_build_object('title', 'Briefing 4', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-zip', 'type', 'zip', 'payloadSchemaVersion', 1,
      'timeLimitMs', 90000, 'points', 14,
      'publicPayload', jsonb_build_object('category', 'Lógica espacial', 'tags', '{}'::jsonb,
        'question', 'Une los números en orden y cubre la cuadrícula.',
        'grid', jsonb_build_object('rows', 5, 'columns', 5),
        'checkpoints', jsonb_build_array(
          jsonb_build_object('value', 1, 'cell', 0), jsonb_build_object('value', 2, 'cell', 4),
          jsonb_build_object('value', 3, 'cell', 5), jsonb_build_object('value', 4, 'cell', 14),
          jsonb_build_object('value', 5, 'cell', 15), jsonb_build_object('value', 6, 'cell', 24))),
      'solutionPayload', jsonb_build_object('solution', jsonb_build_array(
        0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24),
        'explanation', 'El camino visita los seis checkpoints y recorre las 25 celdas.'),
      'modeConfig', jsonb_build_object('levelId', 'level-5', 'label', 'Nivel 5',
        'briefing', jsonb_build_object('title', 'Briefing 5', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-escape', 'type', 'escape', 'payloadSchemaVersion', 1,
      'timeLimitMs', 60000, 'points', 15,
      'publicPayload', jsonb_build_object('category', 'Lógica espacial', 'tags', '{}'::jsonb,
        'question', 'Mueve los bloques para liberar la pieza amarilla.',
        'grid', jsonb_build_object('rows', 6, 'columns', 6, 'exit', jsonb_build_object('side', 'right', 'row', 2)),
        'initialBlocks', jsonb_build_array(
          jsonb_build_object('id', 'target', 'kind', 'target', 'orientation', 'horizontal', 'row', 2, 'column', 0, 'length', 2),
          jsonb_build_object('id', 'a', 'kind', 'obstacle', 'orientation', 'vertical', 'row', 1, 'column', 2, 'length', 2),
          jsonb_build_object('id', 'b', 'kind', 'obstacle', 'orientation', 'vertical', 'row', 0, 'column', 4, 'length', 3),
          jsonb_build_object('id', 'c', 'kind', 'obstacle', 'orientation', 'horizontal', 'row', 0, 'column', 1, 'length', 2),
          jsonb_build_object('id', 'd', 'kind', 'obstacle', 'orientation', 'horizontal', 'row', 4, 'column', 1, 'length', 2)),
        'boardLabel', 'Tablero Escape de Pirámide'),
      'solutionPayload', jsonb_build_object('referenceSolution', jsonb_build_array(
        jsonb_build_object('blockId', 'c', 'from', 1, 'to', 0),
        jsonb_build_object('blockId', 'a', 'from', 1, 'to', 0),
        jsonb_build_object('blockId', 'b', 'from', 0, 'to', 3),
        jsonb_build_object('blockId', 'target', 'from', 0, 'to', 4)),
        'optimalMoves', 4, 'explanation', 'Despeja la fila del objetivo y llévalo a la salida.'),
      'modeConfig', jsonb_build_object('levelId', 'level-6', 'label', 'Nivel 6',
        'briefing', jsonb_build_object('title', 'Briefing 6', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    ),
    jsonb_build_object(
      'slug', 's15-format-word-hashtag', 'type', 'word-hashtag', 'payloadSchemaVersion', 1,
      'timeLimitMs', 60000, 'points', 15,
      'publicPayload', jsonb_build_object('category', 'Lengua', 'tags', '{}'::jsonb,
        'question', 'Intercambia las letras para completar las cuatro palabras.',
        'grid', jsonb_build_object('rows', 5, 'columns', 5),
        'initialLetters', jsonb_build_array(
          null, 'G', null, 'Q', null, 'E', 'O', 'P', 'U', 'I', null, 'N', null, 'Y', null,
          'R', 'A', 'U', 'M', 'E', null, 'R', null, 'A', null),
        'maxMoves', 3),
      'solutionPayload', jsonb_build_object('words', jsonb_build_object(
        'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'QUEMA'),
        'explanation', 'Tres intercambios completan YOGUI, REUMA, PONER y QUEMA.'),
      'modeConfig', jsonb_build_object('levelId', 'level-7', 'label', 'Nivel 7',
        'briefing', jsonb_build_object('title', 'Briefing 7', 'format', 'Prueba', 'description', 'Resuelve el nivel para ascender.'))
    )
  )
)::text, true);

set local role authenticated;
select is((public.create_superadmin_flash_draft(jsonb_build_object(
  'idempotencyKey', 's15-format-pyramid-create',
  'document', current_setting('s15.mixed_pyramid_document')::jsonb,
  'reason', 'Crear Pirámide con siete formatos'
))->>'status'), 'draft', 'The editor can prepare a Pyramid with all seven competitive formats');
reset role;
select set_config('s15.mixed_pyramid_version', (
  select id::text from private.challenge_versions where title = 'Pirámide con siete formatos' and status = 'draft'
), true);
select set_config('s15.format_question_versions', (
  select jsonb_agg(jsonb_build_object('id', question.id, 'updatedAt', question.updated_at) order by item.position)::text
  from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
), true);
set local role authenticated;
do $$
declare
  item jsonb;
begin
  for item in select value from jsonb_array_elements(current_setting('s15.format_question_versions')::jsonb)
  loop
    perform public.publish_superadmin_question(jsonb_build_object(
      'idempotencyKey', 's15-format-publish-' || (item->>'id'),
      'questionVersionId', (item->>'id')::uuid,
      'expectedUpdatedAt', (item->>'updatedAt')::timestamptz,
      'reason', 'Publicar formato competitivo S15'
    ));
  end loop;
end;
$$;
reset role;

select is((select count(*) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and question.status = 'published'
    and question.type in ('true-false', 'ordering', 'classification', 'logic-matrix', 'zip', 'escape', 'word-hashtag')), 7::bigint,
  'All seven formats have published question versions');
select is((select count(*) from private.challenge_items item
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and private.is_supported_flash_question(item.question_version_id)), 7::bigint,
  'The shared admission predicate accepts all seven valid levels for Flash, Survival and Pyramid');

select is((select private.zip_content_valid(
  question.public_payload,
  jsonb_set(solution.solution_payload, '{solution,0}', '1'::jsonb)
) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and question.type = 'zip'), false, 'Zip rejects an incomplete or invalid published path');
select is((select private.escape_content_valid(
  question.public_payload,
  jsonb_set(solution.solution_payload, '{referenceSolution,0,to}', '99'::jsonb)
) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and question.type = 'escape'), false, 'Escape rejects an invalid reference move');
select is((select private.word_hashtag_content_valid(
  question.public_payload,
  jsonb_set(solution.solution_payload, '{words,top}', '"INVALID"'::jsonb)
) from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and question.type = 'word-hashtag'), false, 'Word Hashtag rejects incompatible target words');
select is((select private.is_valid_published_competitive_question_format(question.id, 'escape')
  from private.challenge_items item
  join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = current_setting('s15.mixed_pyramid_version')::uuid
    and question.type = 'zip'), false, 'A published question cannot be admitted under a different format');

select throws_ok($$select private.validate_flash_editorial_document(
  jsonb_set(current_setting('s15.mixed_pyramid_document')::jsonb,
    '{questions,1,solutionPayload,correctOrder}', '["A","A","C"]'::jsonb)
)$$, '22023', 'invalid_solution_payload', 'An ordering solution with duplicate values is rejected by the shared editorial validator');

select set_config('s15.mixed_pyramid_updated_at', (
  select updated_at::text from private.challenge_versions where id = current_setting('s15.mixed_pyramid_version')::uuid
), true);
set local role authenticated;
select is((public.publish_superadmin_flash(jsonb_build_object(
  'idempotencyKey', 's15-format-pyramid-publish',
  'challengeVersionId', current_setting('s15.mixed_pyramid_version')::uuid,
  'expectedUpdatedAt', current_setting('s15.mixed_pyramid_updated_at')::timestamptz,
  'reason', 'Publicar Pirámide con siete formatos'
))->>'status'), 'published', 'PostgreSQL publishes the seven-level mixed-format Pyramid');
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's15-format-pyramid-schedule',
  'seasonId', test_support.id('season-pyramid'),
  'challengeVersionId', current_setting('s15.mixed_pyramid_version')::uuid,
  'number', 3,
  'opensAt', now() + interval '1 day 3 hours',
  'closesAt', now() + interval '1 day 4 hours',
  'reason', 'Programar Pirámide con siete formatos'
))->>'status'), 'scheduled', 'The calendar schedules the published mixed-format Pyramid');
reset role;

select * from finish();
rollback;
