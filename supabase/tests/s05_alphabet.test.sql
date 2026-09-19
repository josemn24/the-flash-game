begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

insert into public.rooms(id, slug, title)
values (test_support.id('s05a-room'), 's05-alphabet-room', 'Sala S05');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('s05a-room'), test_support.id('owner'), 'owner');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('s05a-season'), test_support.id('s05a-room'), 'Temporada S05', 'active',
  now() - interval '1 hour', now() + interval '1 day');
insert into private.question_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s05a-qd-a'), 's05-alphabet-a', test_support.id('superadmin')),
  (test_support.id('s05a-qd-b'), 's05-alphabet-b', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id)
values
  (test_support.id('s05a-qv-a'), test_support.id('s05a-qd-a'), 1, 1, 'draft', 'short-text', 30000,
    '{"question":"¿Quién fue Ada?"}', test_support.id('superadmin')),
  (test_support.id('s05a-qv-b'), test_support.id('s05a-qd-b'), 1, 1, 'draft', 'short-text', 30000,
    '{"question":"¿Qué significa B?"}', test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (test_support.id('s05a-qv-a'), '{"correctAnswer":"Lovelace","acceptedAnswers":["Lovelace"]}'),
  (test_support.id('s05a-qv-b'), '{"correctAnswer":"Beta","acceptedAnswers":["Beta"]}');
update private.question_versions
set status = 'published', published_at = now()
where id in (test_support.id('s05a-qv-a'), test_support.id('s05a-qv-b'));

select lives_ok($$
  select private.validate_flash_question_document(jsonb_build_object(
    'slug', 's05-library-short-text', 'type', 'short-text', 'payloadSchemaVersion', 1,
    'timeLimitMs', 30000,
    'publicPayload', jsonb_build_object('question', '¿Quién fue Ada?', 'answerPlaceholder', 'Nombre'),
    'solutionPayload', jsonb_build_object('correctAnswer', 'Lovelace', 'acceptedAnswers', jsonb_build_array('Lovelace'))
  ))
$$, 'La biblioteca acepta una pregunta short-text independiente');

select lives_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug', 's05-alphabet-editorial', 'title', 'Alfabeto', 'subtitle', 'Letras',
      'description', 'S05', 'mode', 'alphabet', 'configSchemaVersion', 1,
      'globalTimeLimitMs', 120000, 'modeConfig', '{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('source', 'library', 'questionVersionId', test_support.id('s05a-qv-a')::text,
        'points', 50, 'modeConfig', jsonb_build_object('letter', 'A')),
      jsonb_build_object('source', 'library', 'questionVersionId', test_support.id('s05a-qv-b')::text,
        'points', 50, 'modeConfig', jsonb_build_object('letter', 'B')))
  ))
$$, 'El validador acepta un Alphabet con referencias short-text');

select throws_ok($$
  select private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug', 's05-alphabet-invalid', 'title', 'Alfabeto', 'subtitle', 'Letras',
      'description', 'S05', 'mode', 'alphabet', 'configSchemaVersion', 1,
      'globalTimeLimitMs', 120000, 'modeConfig', '{}'::jsonb),
    'questions', jsonb_build_array(
      jsonb_build_object('source', 'library', 'questionVersionId', test_support.id('s05a-qv-a')::text,
        'points', 50, 'modeConfig', jsonb_build_object('letter', 'A')),
      jsonb_build_object('source', 'library', 'questionVersionId', test_support.id('s05a-qv-b')::text,
        'points', 50, 'modeConfig', jsonb_build_object('letter', 'a')))
  ))
$$, '22023', 'duplicate_alphabet_letter', 'El validador rechaza letras duplicadas');

insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('s05a-cd'), 's05-alphabet', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, global_time_limit_ms, mode_config, created_by_player_id)
values (test_support.id('s05a-cv'), test_support.id('s05a-cd'), 1, 1, 'draft', 'alphabet',
  'Alfabeto S05', 'Letras', 'Prueba S05', 100, 120000, '{}', test_support.id('superadmin'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('s05a-item-a'), test_support.id('s05a-cv'), test_support.id('s05a-qv-a'), 1, 50, 1, '{"letter":"A"}'),
  (test_support.id('s05a-item-b'), test_support.id('s05a-cv'), test_support.id('s05a-qv-b'), 2, 50, 1, '{"letter":"B"}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('s05a-cv');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('s05a-sc'), test_support.id('s05a-season'), test_support.id('s05a-cv'), 20, 'open',
  now() - interval '1 hour', now() + interval '1 hour');

select ok(private.is_supported_flash_question(test_support.id('s05a-qv-a')), 'short-text publicado es jugable');
select test_support.as_actor('owner');
select is((select count(*) from public.get_my_alphabet_challenge('s05-alphabet-room', test_support.id('s05a-sc'))), 2::bigint,
  'La lectura Alphabet devuelve todos los items');
select is((select count(*) from public.get_my_alphabet_challenge('s05-alphabet-room', test_support.id('s05a-sc')) where challenge_mode = 'alphabet'), 2::bigint,
  'La lectura está limitada al modo Alphabet');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('s05a-sc'), 'sessionToken', repeat('z', 40)));
select test_support.run('prepare_interaction');
select is((select last_result->>'questionType' from test_support.runtime), 'short-text', 'Prepare entrega short-text');
select ok(not ((select last_result from test_support.runtime)::text like '%Lovelace%'), 'Prepare no expone la solución');
select is((select last_result->'progress'->>'kind' from test_support.runtime), 'alphabet', 'Prepare entrega progreso Alphabet');
select test_support.run('pass_interaction');
select is((select count(*) from private.attempt_answers), 0::bigint, 'Pasar no crea respuesta final');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":"Beta"}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":"Lovelace"}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select test_support.run('complete_attempt', '{"score":100}');
select is((select count(*) from public.get_my_alphabet_result((select (state->>'attemptId')::uuid from test_support.runtime))), 2::bigint,
  'La revisión terminal devuelve las dos respuestas');
select ok((select count(*) from public.get_my_alphabet_result((select (state->>'attemptId')::uuid from test_support.runtime) ) where solution_payload ? 'correctAnswer') = 2,
  'La solución solo aparece en la revisión terminal');

select * from finish();
rollback;
