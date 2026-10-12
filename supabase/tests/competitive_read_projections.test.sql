begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

-- Valid read fixtures for the modes whose generic command fixtures are minimal.
insert into public.rooms(id, slug, title)
select test_support.id('projection-room-' || mode), 'projection-' || mode, mode
from unnest(array['alphabet','narrative']) mode;
insert into public.room_memberships(room_id, player_id, role)
select test_support.id('projection-room-' || mode), test_support.id(actor), actor
from unnest(array['alphabet','narrative']) mode cross join unnest(array['owner','spectator']) actor;
set constraints all immediate;
set constraints all deferred;
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
select test_support.id('projection-season-' || mode), test_support.id('projection-room-' || mode), mode,
  'active', now() - interval '2 days', now() + interval '2 days'
from unnest(array['alphabet','narrative']) mode;
insert into private.question_definitions(id, slug, created_by_player_id)
select test_support.id('projection-q-' || position), 'projection-q-' || position, test_support.id('superadmin') from generate_series(1,2) position;
insert into private.question_versions(id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('projection-qv-' || position), test_support.id('projection-q-' || position), 1, 'short-text', 60000,
  '{"question":"Example"}'::jsonb, test_support.id('superadmin') from generate_series(1,2) position;
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('projection-qv-' || position), '{"correctAnswer":"Example","acceptedAnswers":[]}'::jsonb from generate_series(1,2) position;
update private.question_versions set status = 'published' where id in (test_support.id('projection-qv-1'),test_support.id('projection-qv-2'));
insert into private.challenge_definitions(id, slug, created_by_player_id)
select test_support.id('projection-cd-' || mode), 'projection-cd-' || mode, test_support.id('superadmin')
from unnest(array['alphabet','narrative']) mode;
insert into private.challenge_versions(id, challenge_definition_id, version_number, mode, title, global_time_limit_ms, mode_config, created_by_player_id)
select test_support.id('projection-cv-' || mode), test_support.id('projection-cd-' || mode), 1, mode, mode,
  case when mode = 'alphabet' then 60000 end,
  case when mode = 'narrative' then '{"prologue":{},"beats":[]}'::jsonb else '{}'::jsonb end,
  test_support.id('superadmin')
from unnest(array['alphabet','narrative']) mode;
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, mode_config)
select test_support.id('projection-item-' || mode || '-' || position), test_support.id('projection-cv-' || mode),
  test_support.id('projection-qv-' || position), position, 50,
  case when mode = 'alphabet' then jsonb_build_object('letter', case when position = 1 then 'A' else 'B' end) else '{}'::jsonb end
from unnest(array['alphabet','narrative']) mode cross join generate_series(1,2) position;
update private.challenge_versions set status = 'published' where id in (test_support.id('projection-cv-alphabet'),test_support.id('projection-cv-narrative'));
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select test_support.id('projection-sc-' || mode), test_support.id('projection-season-' || mode),
  test_support.id('projection-cv-' || mode), 1, 'open', now() - interval '1 day', now() + interval '1 day'
from unnest(array['alphabet','narrative']) mode;

select ok(not has_function_privilege('anon', 'public.get_my_competitive_challenge(text,uuid)', 'EXECUTE'), 'Anonymous cannot read competitive projection');
select ok(not has_function_privilege('service_role', 'public.get_my_competitive_challenge(text,uuid)', 'EXECUTE'), 'Projection is authenticated only');
select ok(not has_function_privilege('authenticated', 'private.read_attempt_context(uuid,text)', 'EXECUTE'), 'Private context is not callable by API users');
select ok(not has_function_privilege('anon', 'private.read_attempt_context(uuid,text)', 'EXECUTE'), 'Anonymous cannot read attempt context');

select test_support.as_actor('owner');
set local role authenticated;
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_flash_challenge('commands-flash',test_support.id('sc-flash')) row), 'Flash matches original projection');
select is(public.get_my_competitive_challenge('projection-alphabet',test_support.id('projection-sc-alphabet'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_alphabet_challenge('projection-alphabet',test_support.id('projection-sc-alphabet')) row), 'Alphabet matches original projection');
select is(public.get_my_competitive_challenge('commands-survival',test_support.id('sc-survival'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_survival_challenge('commands-survival',test_support.id('sc-survival')) row), 'Survival matches original projection');
select is(public.get_my_competitive_challenge('commands-pyramid',test_support.id('sc-pyramid'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_pyramid_challenge('commands-pyramid',test_support.id('sc-pyramid')) row), 'Pyramid matches original projection');
select is(public.get_my_competitive_challenge('projection-narrative',test_support.id('projection-sc-narrative'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_narrative_challenge('projection-narrative',test_support.id('projection-sc-narrative')) row), 'Narrative matches original projection');
select is(public.get_my_competitive_challenge(room_slug,publication_id)->>'mode', mode, mode || ' mode is returned with authorized rows')
from (values ('flash','commands-flash',test_support.id('sc-flash')),('alphabet','projection-alphabet',test_support.id('projection-sc-alphabet')),
 ('survival','commands-survival',test_support.id('sc-survival')),('pyramid','commands-pyramid',test_support.id('sc-pyramid')),
 ('narrative','projection-narrative',test_support.id('projection-sc-narrative'))) scopes(mode,room_slug,publication_id);
select is(public.get_my_competitive_challenge('wrong-room',test_support.id('sc-flash')), null::jsonb, 'Wrong room reveals nothing');
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('missing')), null::jsonb, 'Missing publication reveals nothing');
reset role;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('projection-future'),test_support.id('projection-season-alphabet'),test_support.id('projection-cv-alphabet'),2,'scheduled',now()+interval '25 hours',now()+interval '26 hours'),
 (test_support.id('projection-closed'),test_support.id('projection-season-alphabet'),test_support.id('projection-cv-alphabet'),3,'closed',now()-interval '47 hours',now()-interval '46 hours');
set local role authenticated;
select is(public.get_my_competitive_challenge('projection-alphabet',test_support.id('projection-future')), null::jsonb, 'Future publication without an attempt reveals nothing');
select is(public.get_my_competitive_challenge('projection-alphabet',test_support.id('projection-closed')), null::jsonb, 'Closed publication without an attempt reveals nothing');
reset role;
update private.challenge_versions set status = 'archived' where id = test_support.id('cv-flash');
set local role authenticated;
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_flash_challenge('commands-flash',test_support.id('sc-flash')) row), 'Archived version preserves original projection');
reset role;
select test_support.as_actor('spectator');
set local role authenticated;
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash')), null::jsonb, 'Spectator receives neither mode nor rows');
reset role;
select test_support.as_actor('outsider');
set local role authenticated;
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash')), null::jsonb, 'Outsider receives neither mode nor rows');
reset role;

-- Minimal context authorization is identical to recovery, without its aggregates.
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')));
reset role;
update public.scheduled_challenges set status = 'closed' where id = test_support.id('sc-flash');
set local role authenticated;
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash'))->>'mode', 'flash', 'Existing attempt remains readable after publication closes');
select is(public.get_my_competitive_challenge('commands-flash',test_support.id('sc-flash'))->'rows',
  (select jsonb_agg(to_jsonb(row) order by item_position) from public.get_my_flash_challenge('commands-flash',test_support.id('sc-flash')) row), 'Closed publication with attempt preserves original projection');
reset role;
set local role service_role;
select is((select private.read_attempt_context((state->>'attemptId')::uuid,state->>'sessionToken') from test_support.runtime),
 jsonb_build_object('challengeMode','flash','scheduledChallengeId',test_support.id('sc-flash')), 'Context contains exactly the two required fields');
select throws_ok($$select private.read_attempt_context((state->>'attemptId')::uuid,repeat('x',40)) from test_support.runtime$$, '42501', 'not_authorized', 'Wrong token cannot read context');
select test_support.as_actor('member');
select throws_ok($$select private.read_attempt_context((state->>'attemptId')::uuid,state->>'sessionToken') from test_support.runtime$$, '42501', 'not_authorized', 'Other player cannot read context');
select test_support.as_actor('superadmin');
select throws_ok($$select private.read_attempt_context((state->>'attemptId')::uuid,state->>'sessionToken') from test_support.runtime$$, '42501', 'not_authorized', 'Superadmin cannot read competitive context');
reset role;
select test_support.as_actor('owner');
insert into private.platform_role_assignments(player_id,role) values(test_support.id('owner'),'superadmin');
set local role service_role;
select throws_ok($$select private.read_attempt_context((state->>'attemptId')::uuid,state->>'sessionToken') from test_support.runtime$$, '42501', 'not_authorized', 'Superadmin is excluded even for an owned attempt with the right token');
reset role;
delete from private.platform_role_assignments where player_id = test_support.id('owner');
update private.attempt_sessions set revoked_at = clock_timestamp() where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime);
set local role service_role;
select throws_ok($$select private.read_attempt_context((state->>'attemptId')::uuid,state->>'sessionToken') from test_support.runtime$$, '42501', 'not_authorized', 'Revoked session cannot read context');
reset role;
select * from finish();
rollback;
