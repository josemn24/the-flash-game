begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures
select test_support.as_actor('owner');
set local role service_role;
select test_support.start_ct(4);
select test_support.run('save_queens_draft','{"queens":[2,9,10]}');
select test_support.run('recover_attempt');
select pg_sleep(1.05);
select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->'receiptId' from test_support.runtime),'status','unanswered','points',0)));
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"type":"queens","queens":[2,9,10]}'::jsonb,'Queens SQL-null recovery receipts preserve their accepted draft during completion');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Closure with pending evaluation is idempotent');
select is((select count(*) from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Idempotent closure persists one answer');
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Idempotent closure accredits once');
select is((select progress_payload from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),null::jsonb,'Completion clears mutable progress after capturing the snapshot');
reset role;
grant select on test_support.runtime to authenticated;
set local role authenticated;
select is((select review_state from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=1),
  '{"type":"queens","queens":[2,9,10]}'::jsonb,'Reopened Queens result retains the pending evaluation snapshot');
reset role;
set local role service_role;
select test_support.start_ct(5);
select test_support.run('save_queens_draft','{"queens":[2,9]}');
select pg_sleep(1.05);
select test_support.run('receive_answer','{"answer":null}');
select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->'receiptId' from test_support.runtime),'status','unanswered','points',0)));
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"type":"queens","queens":[2,9]}'::jsonb,'Queens JSON-null answer receipts also preserve their accepted draft');
select is((select points from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0,'Snapshot preservation leaves timeout points at zero');
reset role;
select * from finish();
rollback;
