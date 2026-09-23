begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create temp table s14_attempts(label text primary key, attempt_id uuid not null);
grant select, insert on s14_attempts to service_role;
grant select on s14_attempts to authenticated;
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-survival'), 'sessionToken', repeat('v', 40)));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
insert into s14_attempts values ('survive-first-item',
  (select (state->>'attemptId')::uuid from test_support.runtime));
select throws_ok($$select test_support.run('complete_attempt', '{"score":100,"outcome":"eliminated"}')$$,
  '55000', 'survival_not_terminal', 'A client cannot close a surviving attempt before the last question');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":false}');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select is((select result->>'outcome' from (select private.complete_attempt(jsonb_build_object(
  'idempotencyKey', 's14-complete-eliminated',
  'attemptId', state->>'attemptId',
  'lockVersion', (state->>'lockVersion')::bigint,
  'sessionToken', repeat('v', 40),
  'score', 100,
  'outcome', 'survived'
)) as result from test_support.runtime) completed), 'eliminated',
  'The server derives elimination and ignores a falsified outcome');
reset role;
select is((select score from public.attempts where id=(select attempt_id from s14_attempts where label='survive-first-item')), 50,
  'The official score is the sum of persisted evaluations');
select is((select count(*) from private.flash_point_entries where attempt_id=(select attempt_id from s14_attempts where label='survive-first-item') and entry_type='accreditation'), 1::bigint,
  'Elimination credits the attempt exactly once');
select ok((select status from public.attempts where id=(select attempt_id from s14_attempts where label='survive-first-item'))='completed',
  'Elimination is a completed competitive result');

-- A recovered open answer becomes unanswered and consumes the only life.
update test_support.runtime set state=jsonb_build_object('sessionToken', repeat('w', 40));
select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-survival'), 'sessionToken', repeat('w', 40)));
select test_support.run('prepare_interaction');
select test_support.run('recover_attempt');
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
insert into s14_attempts values ('recovered-elimination',
  (select (state->>'attemptId')::uuid from test_support.runtime));
select is(private.read_attempt_recovery(
  (select attempt_id from s14_attempts where label='recovered-elimination'), repeat('w', 40))->>'livesRemaining', '0',
  'Recovery derives zero remaining lives from its evaluated unanswered receipt');
select test_support.run('complete_attempt', '{"score":100,"outcome":"survived"}');
reset role;
select is((select outcome from public.attempts where id=(select attempt_id from s14_attempts where label='recovered-elimination')), 'eliminated',
  'Recovery after elimination finishes with the derived outcome');
select is((select score from public.attempts where id=(select attempt_id from s14_attempts where label='recovered-elimination')), 0,
  'An unanswered recovery contributes no points');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member2'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_survival_challenge('commands-survival', test_support.id('sc-survival'))), 2::bigint,
  'Authorized members can read Survival slots and lives metadata');
select is((select count(*) from public.get_my_survival_result((select attempt_id from s14_attempts where label='recovered-elimination'))), 1::bigint,
  'The owner can read the reached-question review after completion');
select is((select count(*) from public.get_my_survival_result((select attempt_id from s14_attempts where label='survive-first-item'))), 0::bigint,
  'A member cannot read another player’s Survival review');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-spectator'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_survival_challenge('commands-survival', test_support.id('sc-survival'))), 0::bigint,
  'Spectators receive no playable Survival projection');
select is((select count(*) from public.get_my_survival_result((select attempt_id from s14_attempts where label='recovered-elimination'))), 0::bigint,
  'Spectators cannot read another player’s review');
select * from finish();
rollback;
