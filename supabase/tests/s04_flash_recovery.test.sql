begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('r', 40)));
select test_support.run('prepare_interaction');
select lives_ok($$select test_support.run('recover_attempt')$$,
  'Recovery closes an open Flash interaction');
select is((select last_result->>'recovered' from test_support.runtime), 'true',
  'Prepared interaction is marked as recovered interruption');
reset role;
select is((select end_reason from private.interaction_intervals limit 1), 'recovery_interrupted',
  'Recovery leaves an auditable non-voluntary interval reason');
select is((select answer from private.answer_receipts limit 1), null::jsonb,
  'Recovery persists an internal null answer');
select is((select count(*) from private.answer_receipts), 1::bigint,
  'One recovery creates exactly one receipt');
set local role service_role;
select is(test_support.repeat_last(), (select last_result from test_support.runtime),
  'Recovery retry is idempotent');
select throws_ok($$select test_support.run('prepare_interaction')$$, '55000', 'evaluation_pending',
  'The next payload remains unavailable until the recovered receipt is evaluated');
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
reset role;
select is((select status from private.attempt_answers limit 1), 'unanswered',
  'Recovered null answer can be evaluated as unanswered');
select is((select points from private.attempt_answers limit 1), 0,
  'Recovered unanswered result scores zero');
set local role service_role;
select lives_ok($$select test_support.run('prepare_interaction')$$,
  'Only evaluation authorizes preparing the following Flash question');
reset role;
select * from finish();
rollback;
