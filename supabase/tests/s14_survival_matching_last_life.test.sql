begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

insert into public.rooms(id, slug, title)
values (test_support.id('s14-matching-room'), 's14-matching-room', 'S14 Matching');
insert into public.room_memberships(room_id, player_id, role)
values (test_support.id('s14-matching-room'), test_support.id('member'), 'member');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (
  test_support.id('s14-matching-season'), test_support.id('s14-matching-room'), 'S14 Matching', 'active',
  now() - interval '1 hour', now() + interval '1 day'
);
insert into private.question_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s14-matching-question'), 's14-matching-question', test_support.id('superadmin')),
  (test_support.id('s14-matching-choice'), 's14-matching-choice', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id
)
values
  (
    test_support.id('s14-matching-question-v1'), test_support.id('s14-matching-question'), 1, 1,
    'draft', 'matching', 60000,
    '{"category":"Cultura","question":"Relaciona cada término","leftItems":[{"id":"l1","label":"Uno"},{"id":"l2","label":"Dos"}],"rightItems":[{"id":"r1","label":"Primero"},{"id":"r2","label":"Segundo"}]}',
    test_support.id('superadmin')
  ),
  (
    test_support.id('s14-matching-choice-v1'), test_support.id('s14-matching-choice'), 1, 1,
    'draft', 'multiple-choice', 15000,
    '{"category":"Cultura","question":"¿Capital de Portugal?","options":["Lisboa","Madrid"]}',
    test_support.id('superadmin')
  );
insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (test_support.id('s14-matching-question-v1'), '{"matches":{"l1":"r1","l2":"r2"},"explanation":"Parejas correctas."}'),
  (test_support.id('s14-matching-choice-v1'), '{"correctAnswer":"Lisboa","explanation":"Lisboa."}');
update private.question_versions set status = 'published', published_at = now()
where id in (test_support.id('s14-matching-question-v1'), test_support.id('s14-matching-choice-v1'));
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('s14-matching-challenge'), 's14-matching-challenge', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id, published_at
)
values (
  test_support.id('s14-matching-version'), test_support.id('s14-matching-challenge'), 1, 1, 'draft', 'survival',
  'S14 Matching', 'Una vida', 'Prueba Matching.', 100, '{"lives":1}', test_support.id('superadmin'), null
);
insert into private.challenge_items(
  id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config
)
values
  (test_support.id('s14-matching-item-1'), test_support.id('s14-matching-version'), test_support.id('s14-matching-question-v1'), 1, 50, 1, '{}'),
  (test_support.id('s14-matching-item-2'), test_support.id('s14-matching-version'), test_support.id('s14-matching-choice-v1'), 2, 50, 1, '{}');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('s14-matching-version');
insert into public.scheduled_challenges(
  id, season_id, challenge_version_id, number, status, opens_at, closes_at
)
values (
  test_support.id('s14-matching-publication'), test_support.id('s14-matching-season'),
  test_support.id('s14-matching-version'), 1, 'open', now() - interval '1 hour', now() + interval '1 hour'
);

create temp table s14_matching_attempt(attempt_id uuid not null);
grant select, insert on s14_matching_attempt to service_role;
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('s14-matching-publication'), 'sessionToken', repeat('x', 40)
));
insert into s14_matching_attempt select (state->>'attemptId')::uuid from test_support.runtime;
select test_support.run('prepare_interaction');
select is(
  test_support.run('submit_matching_pair', '{"leftItemId":"l1","rightItemId":"r2"}'::jsonb)->>'terminal',
  'true', 'A wrong Matching pair closes the interaction immediately with the last life'
);
select is((select last_result->>'correct' from test_support.runtime), 'false',
  'The server identifies the failed Matching pair');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}'::jsonb);
select test_support.run('complete_attempt', '{"score":100,"outcome":"survived"}'::jsonb);
reset role;

select is((select status from public.attempts where id = (select attempt_id from s14_matching_attempt)), 'completed',
  'The terminal Matching error completes the Survival attempt');
select is((select outcome from public.attempts where id = (select attempt_id from s14_matching_attempt)), 'eliminated',
  'The server derives elimination after the final-life Matching error');
select is((select score from public.attempts where id = (select attempt_id from s14_matching_attempt)), 0,
  'The Matching attempt score is derived from the persisted evaluation');
select is((
  select count(*) from private.flash_point_entries
  where attempt_id = (select attempt_id from s14_matching_attempt) and entry_type = 'accreditation'
), 1::bigint, 'The eliminated Matching attempt earns exactly one accreditation');

select * from finish();
rollback;
