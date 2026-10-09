begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures

select test_support.as_actor('owner');
set local role service_role;
select test_support.start_pyramid_queens();
select is((select last_result->'progress'->'incorrectValidations' from test_support.runtime),
  '0'::jsonb, 'Queens begins with zero failed validations at the middle level');
select is((select last_result->'progress'->'maxIncorrectValidations' from test_support.runtime),
  '3'::jsonb, 'The public Pyramid progress has a fixed limit of three');
select test_support.run('activate_interaction');
select throws_ok($$select test_support.run('submit_queens_placement', '{"cell":0,"action":"place"}')$$,
  '22023', 'queens_requires_board_validation', 'Legacy placement cannot bypass Pyramid validation');
select throws_ok($$select test_support.run('submit_queens_answer', '{"queens":[2,9,10,18]}')$$,
  '22023', 'queens_answer_incomplete', 'Incomplete boards do not consume an opportunity');
select throws_ok($$select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,20,24]}')$$,
  '22023', 'queens_answer_overflow', 'Overflow boards do not consume an opportunity');
select throws_ok($$select test_support.run('submit_queens_answer', '{"queens":[2,2,5,14,20]}')$$,
  '22023', 'invalid_queens_answer', 'Repeated cells do not consume an opportunity');
select test_support.run('save_queens_draft', '{"queens":[0,2]}');
select is((select last_result->'incorrectValidations' from test_support.runtime), '0'::jsonb,
  'Draft edits leave all three opportunities available');
select is((select last_result->'maxIncorrectValidations' from test_support.runtime), '3'::jsonb,
  'Draft responses preserve the limit');
select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,20]}');
select is((select last_result->'incorrectValidations' from test_support.runtime), '1'::jsonb, 'First failure leaves two opportunities');
select is((select last_result->'terminal' from test_support.runtime), 'false'::jsonb, 'First failure keeps the level open');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'A replay consumes no additional opportunity');
select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,24]}');
select is((select last_result->'incorrectValidations' from test_support.runtime), '2'::jsonb, 'Second failure leaves one opportunity');
select is((select last_result->'terminal' from test_support.runtime), 'false'::jsonb, 'Second failure keeps the level open');
select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,21]}');
select is((select last_result->'incorrectValidations' from test_support.runtime), '3'::jsonb, 'Third failure exhausts the opportunities');
select is((select last_result->'terminal' from test_support.runtime), 'true'::jsonb, 'Third failure closes the level');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'Terminal validation replays its sole receipt');
select is(private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('q', 40))->'incorrectValidations',
  '3'::jsonb, 'The evaluator reads the count from persisted events');
select is(private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime), repeat('q', 40))->'answer',
  '{"queens":[0,2,5,14,21],"marks":[]}'::jsonb, 'The final receipt retains the submitted board');
select throws_ok($$select test_support.run('submit_queens_answer', '{"queens":[2,9,10,18,21]}')$$,
  '55000', 'interaction_not_presented', 'A fourth validation cannot continue the level');
select throws_ok($$select test_support.run('save_queens_draft', '{"queens":[2]}')$$,
  '55000', 'interaction_not_presented', 'Drafts are rejected after terminal validation');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0,"resultDetails":{"type":"queens","failureReason":"attempts_exhausted","solved":false,"incorrectAttempts":3}}');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'The exhausted result is recorded idempotently');
select throws_ok($$select test_support.run('prepare_interaction')$$,
  '55000', 'pyramid_level_failed', 'The next level is unavailable after exhausting attempts');
select is(test_support.run('complete_attempt', '{"score":0,"outcome":"failed"}')->>'outcome', 'failed', 'Exhaustion finishes Pyramid as failed');
select is(test_support.repeat_last(), (select last_result from test_support.runtime), 'Failure finalization is idempotent');
reset role;
select is((select count(*) from private.queens_validation_events
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)), 3::bigint, 'There are exactly three failed events');
select is((select count(*) from private.answer_receipts
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)
    and challenge_item_id = test_support.id('pyramid-queens-item-2')), 1::bigint, 'There is exactly one Queens receipt');
select is((select score from public.attempts
  where id = (select (state->>'attemptId')::uuid from test_support.runtime)), 14, 'Earlier level points remain credited');
select is((select count(*) from private.flash_point_entries
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)
    and entry_type = 'accreditation'), 1::bigint, 'Failure posts one ranking credit');
select is((select result_details->>'failureReason' from private.attempt_answers
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)
    and challenge_item_id = test_support.id('pyramid-queens-item-2')), 'attempts_exhausted', 'Review preserves the exhaustion reason');

-- Success on opportunity 1, 2 or 3 remains eligible for the next level.
set local role service_role;
do $$
declare failures integer;
begin
  for failures in 0..2 loop
    perform test_support.start_pyramid_queens(3 + failures);
    perform test_support.run('activate_interaction');
    for n in 1..failures loop
      perform test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,20]}');
    end loop;
    perform test_support.run('submit_queens_answer', '{"queens":[2,9,10,18,21]}');
    if (select last_result->>'correct' from test_support.runtime) <> 'true'
      or (select (last_result->>'incorrectValidations')::integer from test_support.runtime) <> failures then
      raise exception 'Success must remain available on opportunity %', failures + 1;
    end if;
    perform test_support.run('record_evaluation', jsonb_build_object('status','correct','points',14 - failures));
    perform test_support.run('prepare_interaction');
    if (select last_result->>'challengeItemId' from test_support.runtime) <> test_support.id('pyramid-queens-item-3')::text then
      raise exception 'Success must advance to level 3';
    end if;
  end loop;
end;
$$;
select pass('Correct boards pass on the first, second and third opportunities');

-- A server deadline takes precedence over a new validation, preserving the timeout policy.
select test_support.start_pyramid_queens(6);
select test_support.run('activate_interaction');
select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,20]}');
select test_support.run('submit_queens_answer', '{"queens":[0,2,5,14,24]}');
select pg_sleep(1.05);
select throws_ok($$select test_support.run('submit_queens_answer', '{"queens":[2,9,10,18,21]}')$$,
  '55000', 'deadline_reached', 'A validation after the server deadline is rejected');
select test_support.run('recover_attempt');
select is(private.read_evaluation_context(
  (select (last_result->>'receiptId')::uuid from test_support.runtime),
  (select state->>'sessionToken' from test_support.runtime))->'incorrectValidations',
  '2'::jsonb, 'A late validation does not consume a third opportunity');
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
select is(test_support.run('complete_attempt', '{"score":0,"outcome":"failed"}')->>'outcome', 'failed', 'Timeout retains Pyramid failure policy');
select * from finish();
rollback;
