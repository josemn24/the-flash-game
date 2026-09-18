begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select lives_ok($$
  select private.validate_flash_editorial_document(
    jsonb_build_object(
      'challenge', jsonb_build_object(
        'slug', 'e03-editorial', 'title', 'E03', 'subtitle', 'Pistas', 'description', 'E03',
        'mode', 'flash', 'configSchemaVersion', 1, 'modeConfig', '{}'::jsonb),
      'questions', jsonb_build_array(
        jsonb_build_object(
          'slug', 'e03-editorial-choice', 'type', 'multiple-choice', 'payloadSchemaVersion', 1,
          'timeLimitMs', 15000, 'points', 50,
          'publicPayload', jsonb_build_object('question', '¿Capital?', 'options', jsonb_build_array('Lisboa', 'Madrid')),
          'solutionPayload', jsonb_build_object('correctAnswer', 'Lisboa')),
        jsonb_build_object(
          'slug', 'e03-editorial-progressive', 'type', 'progressive-clues', 'payloadSchemaVersion', 1,
          'timeLimitMs', 60000, 'points', 50,
          'publicPayload', jsonb_build_object('question', '¿Qué ocurrió?',
            'clues', jsonb_build_array('Pista uno', 'Pista dos'), 'cluePenalty', 25),
          'solutionPayload', jsonb_build_object('correctAnswer', 'Respuesta',
            'acceptedAnswers', jsonb_build_array('respuesta')))
      )
    )
  )
$$,
  'El validador editorial acepta un Flash mixto con Progressive-clues');
select is(to_regclass('private.progressive_clue_events_item_idx')::text,
  'private.progressive_clue_events_item_idx', 'Existe el índice de consulta por intento/item/pista');
select ok((select relrowsecurity from pg_class where oid = 'private.progressive_clue_reveal_events'::regclass),
  'RLS está habilitado en los eventos Progressive-clues');
select ok(not has_table_privilege('service_role', 'private.progressive_clue_reveal_events', 'SELECT'),
  'service_role no tiene lectura directa de eventos Progressive-clues');

insert into public.rooms(id, slug, title)
values (test_support.id('e03-room'), 'e03-progressive-clues-room', 'Sala E03');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('e03-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('e03-season'), test_support.id('e03-room'), 'Temporada E03', 'active',
  now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('e03-q'), 'e03-progressive-clues', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id)
values (
  test_support.id('e03-qv'), test_support.id('e03-q'), 1, 1, 'draft', 'progressive-clues',
  60000, '{"category":"Historia","question":"Identifica el acontecimiento","clues":["Ocurrió en Europa.","Está relacionado con una caída de muro.","Sucedió en 1989."],"cluePenalty":25}',
  test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('e03-qv'), '{"correctAnswer":"Caída del muro de Berlín","acceptedAnswers":["caida del muro de berlin"," Muro de Berlín "],"explanation":"La respuesta identifica el acontecimiento."}');
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version, status, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('e03-qv-2'), question_definition_id, 2, payload_schema_version, 'draft', type, time_limit_ms, public_payload, created_by_player_id
from private.question_versions where id = test_support.id('e03-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('e03-qv-2'), solution_payload from private.question_version_solutions where question_version_id = test_support.id('e03-qv');
update private.question_versions set status = 'published', published_at = now()
where id in (test_support.id('e03-qv'), test_support.id('e03-qv-2'));
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('e03-cd'), 'e03-progressive-clues-flash', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  test_support.id('e03-cv'), test_support.id('e03-cd'), 1, 1, 'draft', 'flash',
  'Flash Progressive-clues', 'Una pista cada vez', 'Prueba competitiva de E03.',
  100, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('e03-item-1'), test_support.id('e03-cv'), test_support.id('e03-qv'), 1, 80, 1, '{}'),
  (test_support.id('e03-item-2'), test_support.id('e03-cv'), test_support.id('e03-qv-2'), 2, 20, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('e03-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('e03-sc'), test_support.id('e03-season'), test_support.id('e03-cv'), 20, 'open',
  now() - interval '1 hour', now() + interval '1 hour');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('e03-sc'), 'sessionToken', repeat('e', 40)));
select test_support.run('prepare_interaction');
reset role;
select ok(not ((select last_result from test_support.runtime)::text like '%Caída del muro%'),
  'Prepare no expone la solución');
select ok(not ((select last_result from test_support.runtime)::text like '%Está relacionado%'),
  'Prepare no expone pistas futuras');
select is((select last_result->'publicPayload' ? 'clues' from test_support.runtime), false,
  'El payload jugable no contiene el array completo');
select is((select last_result->'progress'->'clues' from test_support.runtime), '["Ocurrió en Europa."]'::jsonb,
  'La preparación registra y devuelve la primera pista gratuita');
select is((select (last_result->'progress'->>'availablePoints')::integer from test_support.runtime), 80,
  'La primera pista conserva todos los puntos del item');
select is((select count(*) from private.progressive_clue_reveal_events), 1::bigint,
  'La pista inicial crea un único evento');
select is((select penalty_points from private.progressive_clue_reveal_events), 0,
  'La pista inicial no aplica penalización');

select lives_ok($$select test_support.run('reveal_progressive_clue')$$,
  'La segunda pista se revela mediante el comando dedicado');
select is((select last_result->>'clue' from test_support.runtime), 'Está relacionado con una caída de muro.',
  'El comando devuelve únicamente la siguiente pista');
select is((select (last_result->>'availablePoints')::integer from test_support.runtime), 40,
  'La penalización escala usando los 80 puntos reales del item');
select is((select count(*) from private.progressive_clue_reveal_events), 2::bigint,
  'La segunda pista se registra como segundo evento');
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'Repetir la misma revelación devuelve el resultado idempotente');
select throws_ok($$select test_support.repeat_last('{"challengeItemId":"00000000-0000-0000-0000-000000000001"}')$$,
  '40001', 'idempotency_conflict', 'La misma clave no se puede cambiar de item');

select lives_ok($$select test_support.run('reveal_progressive_clue')$$,
  'La última pista se revela secuencialmente');
select is((select (last_result->>'availablePoints')::integer from test_support.runtime), 0,
  'El máximo disponible se limita a cero al agotar los puntos');
select is((select (last_result->>'revealedClues')::integer from test_support.runtime), 3,
  'El contador procede de los eventos persistidos');
select throws_ok($$select test_support.run('reveal_progressive_clue')$$,
  '55000', 'all_clues_revealed', 'No se puede revelar una pista futura');
select throws_ok($$select test_support.run('reveal_progressive_clue', '{"lockVersion":1}')$$,
  '40001', 'stale_version', 'Una versión obsoleta se rechaza antes de revelar');

select lives_ok($$select test_support.run('receive_answer', '{"answer":"  Muro de Berlin "}')$$,
  'La respuesta usa el endpoint genérico una sola vez');
select test_support.as_actor('owner');
set local role service_role;
select is((select (private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('e', 40)
)->>'progressiveCluesRevealed')::integer from test_support.runtime), 3,
  'La evaluación reconstruye las pistas desde los eventos');
reset role;
select test_support.run('record_evaluation', '{"status":"correct","points":0}');
select throws_ok($$select test_support.run('reveal_progressive_clue')$$,
  '55000', 'interaction_not_presented', 'Una interacción cerrada ya no admite pistas');

select test_support.run('prepare_interaction');
select lives_ok($$select test_support.run('recover_attempt')$$,
  'La recuperación conserva una interacción progressive-clues abierta');
select is((select (last_result->>'preserved')::boolean from test_support.runtime), true,
  'La recuperación devuelve la interacción preservada');
select test_support.run('prepare_interaction');
select is((select last_result->'progress'->'revealedClues' from test_support.runtime), '1'::jsonb,
  'La recarga reconstruye la primera pista del siguiente item');

select * from finish();
rollback;
