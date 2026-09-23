begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create temp table s14_survival_attempt(attempt_id uuid not null);
grant select, insert on s14_survival_attempt to service_role;
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-survival'), 'sessionToken', repeat('z', 40)
));
insert into s14_survival_attempt select (state->>'attemptId')::uuid from test_support.runtime;
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}'::jsonb);
select test_support.run('record_evaluation', '{"status":"correct","points":50}'::jsonb);
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}'::jsonb);
select test_support.run('record_evaluation', '{"status":"correct","points":50}'::jsonb);

select test_support.run('complete_attempt', '{"score":0,"outcome":"eliminated"}'::jsonb);
select is((select last_result->>'outcome' from test_support.runtime), 'survived',
  'The server derives survival after every question is answered without mistakes');
select is((select last_result->>'score' from test_support.runtime), '100',
  'The final score is the sum of persisted evaluator results');
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'Repeating the same finalization is idempotent');
select throws_ok($$select test_support.run('prepare_interaction')$$, '42501', 'session_revoked',
  'A terminal Survival attempt cannot continue to another question');
reset role;

select is((select outcome from public.attempts where id = (select attempt_id from s14_survival_attempt)), 'survived',
  'The persisted attempt records the derived Survival outcome');
select is((select score from public.attempts where id = (select attempt_id from s14_survival_attempt)), 100,
  'The persisted attempt ignores the client-supplied score');
select is((
  select count(*) from private.flash_point_entries
  where attempt_id = (select attempt_id from s14_survival_attempt) and entry_type = 'accreditation'
), 1::bigint, 'Surviving completion accredits the ranking exactly once');

select * from finish();
rollback;
