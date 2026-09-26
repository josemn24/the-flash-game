begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create temp table s14_timeout_attempt(attempt_id uuid not null);
grant select, insert on s14_timeout_attempt to service_role;
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-survival'), 'sessionToken', repeat('t', 40)
));
insert into s14_timeout_attempt select (state->>'attemptId')::uuid from test_support.runtime;
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":null}'::jsonb);
select test_support.run('record_evaluation', '{"status":"timeout","points":0}'::jsonb);
select test_support.run('complete_attempt', '{"score":100,"outcome":"survived"}'::jsonb);
reset role;

select is((select outcome from public.attempts where id = (select attempt_id from s14_timeout_attempt)), 'eliminated',
  'A persisted timeout consumes a Survival life even when the client claims a win');
select is((select score from public.attempts where id = (select attempt_id from s14_timeout_attempt)), 0,
  'A timed-out answer does not add client-supplied points');
select is((
  select count(*) from private.flash_point_entries
  where attempt_id = (select attempt_id from s14_timeout_attempt) and entry_type = 'accreditation'
), 1::bigint, 'Timeout elimination is credited once');

select * from finish();
rollback;
