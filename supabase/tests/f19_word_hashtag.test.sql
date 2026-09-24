begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select ok(not has_function_privilege('anon', 'private.word_hashtag_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'Anonymous cannot invoke the Word-hashtag content validator');
select ok(not has_function_privilege('service_role', 'private.word_hashtag_content_valid(jsonb,jsonb)', 'EXECUTE'),
  'service_role cannot invoke the Word-hashtag content validator directly');
select ok(not has_function_privilege('anon', 'private.submit_word_hashtag_swap(jsonb)', 'EXECUTE'),
  'Anonymous cannot invoke the Word-hashtag swap command');

select ok(private.word_hashtag_content_valid(
  jsonb_build_object(
    'question', 'Intercambia las letras.',
    'grid', jsonb_build_object('rows', 5, 'columns', 5),
    'initialLetters', jsonb_build_array(
      null, 'G', null, 'Q', null,
      'E', 'O', 'P', 'U', 'I',
      null, 'N', null, 'Y', null,
      'R', 'A', 'U', 'M', 'E',
      null, 'R', null, 'A', null
    ),
    'maxMoves', 7
  ),
  jsonb_build_object('words', jsonb_build_object(
    'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'QUEMA'
  ))
), 'A valid Word-hashtag editorial contract is accepted');

select ok(not private.word_hashtag_content_valid(
  jsonb_build_object(
    'question', 'Intercambia las letras.',
    'grid', jsonb_build_object('rows', 5, 'columns', 5),
    'initialLetters', jsonb_build_array(
      null, 'G', null, 'Q', null,
      'E', 'O', 'P', 'U', 'I',
      null, 'N', null, 'Y', null,
      'R', 'A', 'U', 'M', 'E',
      null, 'R', null, 'A', null
    ),
    'maxMoves', 7
  ),
  jsonb_build_object('words', jsonb_build_object(
    'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'OTRA'
  ))
), 'Inconsistent Word-hashtag crossings are rejected');

insert into public.rooms(id, slug, title)
values (test_support.id('f19-progress-room'), 'f19-word-hashtag-progress', 'Sala F19 progress');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('f19-progress-room'), test_support.id('member'), 'member');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('f19-progress-season'), test_support.id('f19-progress-room'),
  'Temporada F19 progress', 'active', now() - interval '1 hour', now() + interval '1 day');

insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('f19-q'), 'f19-word-hashtag-progress', test_support.id('superadmin'));
insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('f19-qv'), test_support.id('f19-q'), 1, 1, 'draft', 'word-hashtag', 60000,
  jsonb_build_object(
    'question', 'Intercambia las letras.',
    'grid', jsonb_build_object('rows', 5, 'columns', 5),
    'initialLetters', jsonb_build_array(
      null, 'G', null, 'Q', null,
      'E', 'O', 'P', 'U', 'I',
      null, 'N', null, 'Y', null,
      'R', 'A', 'U', 'M', 'E',
      null, 'R', null, 'A', null
    ),
    'maxMoves', 7
  ), test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('f19-qv'), jsonb_build_object('words', jsonb_build_object(
  'top', 'YOGUI', 'bottom', 'REUMA', 'left', 'PONER', 'right', 'QUEMA'
)));
update private.question_versions set status = 'published', published_at = now()
where id = test_support.id('f19-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('f19-cd'), 'f19-word-hashtag-progress', test_support.id('superadmin'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('f19-cv'), test_support.id('f19-cd'), 1, 1, 'draft', 'flash',
  'Flash Word Hashtag test', 'Progress', 'Fixture SQL.', 100, '{}', test_support.id('superadmin'));
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values (test_support.id('f19-item'), test_support.id('f19-cv'), test_support.id('f19-qv'), 1, 100, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('f19-cv');
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (test_support.id('f19-sc'), test_support.id('f19-progress-season'), test_support.id('f19-cv'),
  2, 'open', now() - interval '1 hour', now() + interval '1 day');

select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('f19-sc'), 'sessionToken', repeat('h', 40)));
select test_support.run('prepare_interaction');
select is((select last_result->'progress'->'correctCells' from test_support.runtime),
  jsonb_build_array(3, 6, 8, 9, 11, 15, 17, 18, 21, 23),
  'Initial Word-hashtag progress returns sorted correctly placed cells');
select ok((select last_result::text not like '%YOGUI%' and last_result::text not like '%solutionPayload%'
  from test_support.runtime), 'Initial Word-hashtag progress keeps solution words private');
select throws_ok($$select test_support.run('submit_word_hashtag_swap', jsonb_build_object(
  'challengeItemId', test_support.id('f19-item'), 'fromCell', 3, 'toCell', 1
))$$, '22023', 'invalid_word_hashtag_swap', 'Server rejects moving a correctly placed cell');
select test_support.run('submit_word_hashtag_swap', jsonb_build_object(
  'challengeItemId', test_support.id('f19-item'), 'fromCell', 1, 'toCell', 7
));
select is((select last_result->'correctCells' from test_support.runtime),
  jsonb_build_array(1, 3, 6, 7, 8, 9, 11, 15, 17, 18, 21, 23),
  'Swap response recalculates correctly placed cells in row-major order');
reset role;

select * from finish();
rollback;
