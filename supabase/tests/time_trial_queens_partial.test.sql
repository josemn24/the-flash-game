begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
  type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('ct-partial-qv'), question_definition_id, 3, payload_schema_version,
  type, time_limit_ms, jsonb_set(public_payload, '{prefilledQueens}', '[2,9]'), created_by_player_id
from private.question_versions where id = test_support.id('pyramid-queens-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('ct-partial-qv'), solution_payload
from private.question_version_solutions where question_version_id = test_support.id('pyramid-queens-qv');
update private.question_versions set status = 'published' where id = test_support.id('ct-partial-qv');

insert into private.challenge_versions(id, challenge_definition_id, version_number, mode, title,
  global_time_limit_ms, mode_config, created_by_player_id)
values (test_support.id('ct-cv-3'), test_support.id('ct-cd'), 3, 'time-trial', 'Queens parcial',
  1000, '{"queensTimeoutPartialCredit":true}', test_support.id('owner'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points)
values
  (test_support.id('ct-item-3-1'), test_support.id('ct-cv-3'), test_support.id('ct-partial-qv'), 1, 15),
  (test_support.id('ct-item-3-2'), test_support.id('ct-cv-3'), test_support.id('pyramid-queens-qv'), 2, 85);
update private.challenge_versions set status = 'published' where id = test_support.id('ct-cv-3');

insert into public.rooms(id, slug, title)
select test_support.id('ct-room-'||n), 'ct-room-'||n, 'Queens parcial' from generate_series(13,19) n;
insert into public.room_memberships(room_id, player_id, role)
select test_support.id('ct-room-'||n), m.player_id, m.role from public.room_memberships m
cross join generate_series(13,19) n where m.room_id = test_support.id('room-pyramid');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
select test_support.id('ct-season-'||n), test_support.id('ct-room-'||n), 'CT', 'active',
  now()-interval '1 day', now()+interval '1 day' from generate_series(13,19) n;
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select test_support.id('ct-sc-'||n), test_support.id('ct-season-'||n), test_support.id('ct-cv-3'),
  1, 'open', now()-interval '1 hour', now()+interval '1 day' from generate_series(13,19) n;

select test_support.as_actor('owner');
set local role authenticated;
select is((select can_start from public.get_room_calendar('ct-room-14')), true,
  'The room calendar recognizes an opted-in Queens publication');
select is(public.get_my_competitive_challenge('ct-room-14', test_support.id('ct-sc-14'))
  ->'rows'->0->'queens_timeout_partial_credit', 'true'::jsonb, 'The playable projection exposes the opt-in');
reset role;

set local role service_role;
select test_support.start_ct(13);
select test_support.run('save_queens_draft', '{"queens":[10,18]}');
select test_support.run('save_queens_draft', '{"queens":[]}');
select pg_sleep(1.05);
select is(test_support.run('complete_attempt','{}')->'score', '0'::jsonb,
  'The latest checkpoint with only fixed crowns replaces earlier progress');

select test_support.start_ct(14);
select test_support.run('save_queens_draft', '{"queens":[10]}');
select pg_sleep(1.05);
select throws_ok($$select test_support.run('save_queens_draft','{"queens":[10,18]}')$$,
  '55000', 'deadline_reached', 'Late drafts cannot change the awarded points');
select is(test_support.run('complete_attempt','{}')->'score', '5'::jsonb, 'One player crown earns five points');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'A retried completion replays the partial');
select is((select array_agg(amount) from private.flash_point_entries
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)),
  array[5], 'The partial is accredited exactly once');

select test_support.as_actor('member');
select test_support.start_ct(14);
select test_support.run('save_queens_draft', '{"queens":[0,10,18]}');
select pg_sleep(1.05);
select is(test_support.run('complete_attempt','{}')->'score', '10'::jsonb, 'Two correct crowns and one wrong earn ten points');
select is((select last_result->'timeTrial'->'solvedCount' from test_support.runtime), '0'::jsonb,
  'A partial answer does not count as solved');
reset role;

grant select on test_support.runtime to authenticated;
set local role authenticated;
select is((select answer_status from public.get_my_time_trial_result(
  (select (state->>'attemptId')::uuid from test_support.runtime)) where item_position = 1),
  'partial', 'The authorized result reads the persisted partial');
reset role;

set local role service_role;
select test_support.as_actor('member2');
select test_support.start_ct(14);
select test_support.run('submit_queens_answer', '{"queens":[2,9,10,18,21]}');
select pg_sleep(1.05);
select test_support.run('record_evaluation', '{"status":"correct","points":15}');
select is(test_support.run('complete_attempt','{}')->'score', '15'::jsonb,
  'A correct validation accepted before expiry keeps all fifteen points');
reset role;
set local role authenticated;
select is((select array_agg(flash_points order by position) from public.get_challenge_ranking(test_support.id('ct-sc-14'))),
  array[15,10,5]::bigint[], 'Solved boards come first and partials break ties even with zero solved');
reset role;
update public.scheduled_challenges set status = 'closed' where id = test_support.id('ct-sc-14');
set local role authenticated;
select is((select array_agg(flash_points order by position) from public.get_room_history('ct-room-14', test_support.id('ct-sc-14'))),
  array[15,10,5]::bigint[], 'The history uses the same points tiebreak');
reset role;

select test_support.as_actor('owner');
set local role service_role;
select test_support.start_ct(15);
select test_support.run('save_queens_draft', '{"queens":[10,18,21]}');
select pg_sleep(1.05);
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->'points',
  '15'::jsonb, 'Recovery at expiry awards the full weight for a correct draft');
select is(test_support.run('complete_attempt','{}')->'timeTrial'->>'endReason', 'time_limit',
  'Recovery after the deadline retains the timeout reason');

select test_support.start_ct(16);
select test_support.run('save_queens_draft', '{"queens":[10,18]}');
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->'points',
  '0'::jsonb, 'Recovery that interrupts the board before expiry gets zero');
select is(test_support.run('complete_attempt','{}')->'timeTrial'->>'endReason', 'recovery_interrupted',
  'An early recovery stays an interruption');

select test_support.start_ct(17);
select test_support.run('save_queens_draft', '{"queens":[10,18]}');
select pg_sleep(1.05);
select test_support.run('receive_answer', '{"answer":null}');
select is(test_support.run('complete_attempt', jsonb_build_object('pendingEvaluation', jsonb_build_object(
  'receiptId', (select state->>'receiptId' from test_support.runtime), 'status','unanswered','points',0)))->'score',
  '10'::jsonb, 'Atomic completion scores a pending timeout receipt from the same checkpoint');

select test_support.start_ct(18);
select test_support.run('submit_queens_answer', '{"queens":[0,2,9,10,18]}');
select test_support.run('submit_queens_answer', '{"queens":[0,2,9,10,18]}');
select test_support.run('submit_queens_answer', '{"queens":[0,2,9,10,18]}');
select pg_sleep(1.05);
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select is(test_support.run('complete_attempt','{}')->'score', '0'::jsonb,
  'The third wrong validation earns zero even when evaluated after expiry');

select test_support.start_ct(19);
select test_support.run('save_queens_draft', '{"queens":[10,18]}');
select test_support.run('abandon_attempt');
select is((select count(*) from private.flash_point_entries
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)),
  0::bigint, 'Abandonment with correct saved crowns creates no accreditation');
reset role;

select * from test_support.check_deadline_checkpoint(test_support.id('pyramid-queens-qv'),
  '{"queens":[2,9,10,18,21]}', '{"queens":[2,9,10,18,21]}');

select * from finish();
rollback;
