-- S15 level sequence, recovery, terminal outcome, score and owner-only review.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create temp table s15_attempts(label text primary key, attempt_id uuid not null);
grant select, insert on s15_attempts to service_role, authenticated;

select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-pyramid'), 'sessionToken', repeat('r', 40)));
select test_support.run('prepare_interaction');
insert into s15_attempts values ('interrupted-level',
  (select (state->>'attemptId')::uuid from test_support.runtime));
reset role;
select is((select scope from private.attempt_timing_units
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)), 'level',
  'The first Pyramid checkpoint uses a level clock');
select is((select deadline_at from public.attempts
  where id = (select (state->>'attemptId')::uuid from test_support.runtime)), null::timestamptz,
  'Pyramid has no global attempt deadline');
set local role service_role;
select test_support.run('recover_attempt');
select test_support.run('record_evaluation', '{"status":"unanswered","points":100}');
select is(private.read_attempt_recovery(
  (select attempt_id from s15_attempts where label = 'interrupted-level'), repeat('r', 40))->>'terminalOutcome',
  'failed', 'An interrupted timed level resolves as failed');
select is((select points from private.attempt_answers
  where attempt_id = (select attempt_id from s15_attempts where label = 'interrupted-level')), 0,
  'A Pyramid failed level cannot retain evaluator points');
select throws_ok($$select test_support.run('prepare_interaction')$$,
  '55000', 'pyramid_level_failed', 'The attempt cannot continue after a failed level');
select is((test_support.run('complete_attempt', '{"score":100,"outcome":"summit"}')->>'outcome'),
  'failed', 'The server derives failed and ignores a falsified summit outcome');
reset role;
select is((select score from public.attempts
  where id = (select attempt_id from s15_attempts where label = 'interrupted-level')), 0,
  'An unanswered interrupted level credits zero');
select is((select count(*) from private.flash_point_entries
  where attempt_id = (select attempt_id from s15_attempts where label = 'interrupted-level')
    and entry_type = 'accreditation'), 1::bigint, 'Failure is accredited exactly once');

select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-pyramid'), 'sessionToken', repeat('p', 40)));
insert into s15_attempts values ('summit',
  (select (state->>'attemptId')::uuid from test_support.runtime));
select test_support.run('prepare_interaction');
select throws_ok($$select test_support.run('receive_answer', jsonb_build_object(
  'challengeItemId', test_support.id('item-pyramid-2'), 'answer', true))$$,
  '55000', 'interaction_not_presented', 'The caller cannot skip to a later level');
select test_support.run('receive_answer', '{"answer":"A"}');
select test_support.run('record_evaluation', '{"status":"correct","points":14}');
select throws_ok($$select test_support.run('complete_attempt', '{"score":100,"outcome":"summit"}')$$,
  '55000', 'pyramid_not_terminal', 'A correct early checkpoint cannot be closed as a summit');
select test_support.run('recover_attempt');
select is(private.read_attempt_recovery(
  (select attempt_id from s15_attempts where label = 'summit'), repeat('p', 40))->>'hasOpenInteraction',
  'false', 'Recovery during the briefing preserves the checkpoint without an active timer');
select is(private.read_attempt_recovery(
  (select attempt_id from s15_attempts where label = 'summit'), repeat('p', 40))->>'terminalOutcome',
  null::text, 'A valid briefing recovery remains in progress');
reset role;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_pyramid_challenge(
  'commands-pyramid', test_support.id('sc-pyramid'))), 7::bigint,
  'An authorized member receives the seven level projections');
reset role;
update public.scheduled_challenges set status = 'closed' where id = test_support.id('sc-pyramid');
set local role service_role;
do $$
declare level_index integer;
begin
  for level_index in 2..7 loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('receive_answer', '{"answer":"A"}');
    perform test_support.run('record_evaluation', jsonb_build_object(
      'status', 'correct', 'points', case when level_index < 6 then 14 else 15 end
    ));
  end loop;
end;
$$;
select is((test_support.run('complete_attempt', '{"score":0,"outcome":"failed"}')->>'outcome'),
  'summit', 'Seven successful levels derive summit after the publication closes');
select is((select score from public.attempts
  where id = (select attempt_id from s15_attempts where label = 'summit')), 100,
  'The persisted score is the sum of reached successful evaluations');
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'The Pyramid finalization command is idempotent');
select throws_ok($$select test_support.run('complete_attempt', '{"score":100}')$$,
  '42501', 'session_revoked', 'A second terminal command cannot accredit the attempt again');
reset role;
select is((select outcome from public.attempts
  where id = (select attempt_id from s15_attempts where label = 'summit')), 'summit',
  'The completed attempt persists its server-derived summit outcome');
select is((select count(*) from private.flash_point_entries
  where attempt_id = (select attempt_id from s15_attempts where label = 'summit')
    and entry_type = 'accreditation'), 1::bigint, 'A summit posts exactly one ranking credit');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_pyramid_result(
  (select attempt_id from s15_attempts where label = 'summit'))), 7::bigint,
  'The owner can review the seven reached levels after summit');
select is((select count(*) from public.get_my_pyramid_result(
  (select attempt_id from s15_attempts where label = 'interrupted-level'))), 0::bigint,
  'A different member cannot read another player’s failed level review');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-spectator'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_pyramid_challenge(
  'commands-pyramid', test_support.id('sc-pyramid'))), 0::bigint,
  'Spectators receive no playable level projection');
select is((select count(*) from public.get_my_pyramid_result(
  (select attempt_id from s15_attempts where label = 'summit'))), 0::bigint,
  'Spectators cannot read another player’s Pyramid review');
select * from finish();
rollback;
