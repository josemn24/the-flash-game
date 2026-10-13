begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select ok(not has_function_privilege('anon', 'private.read_alphabet_answer_hint_source(uuid,uuid,text)', 'EXECUTE'), 'Anonymous clients cannot read the source');
select ok(not has_function_privilege('authenticated', 'private.read_alphabet_answer_hint_source(uuid,uuid,text)', 'EXECUTE'), 'Authenticated clients cannot read the source');
select ok(has_function_privilege('service_role', 'private.read_alphabet_answer_hint_source(uuid,uuid,text)', 'EXECUTE'), 'Only the service can execute the private read');

select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-alphabet')));
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-1'), repeat('s',40))$$,
  '42501', 'not_authorized', 'An unpresented question has no readable hint source');
select test_support.run('prepare_interaction');
select is(private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-1'), repeat('s',40)),
  'A', 'The service reads the principal answer for the presented letter');
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-2'), repeat('s',40))$$,
  '42501', 'not_authorized', 'A future letter stays private');
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-flash-1'), repeat('s',40))$$,
  '42501', 'not_authorized', 'An item from another challenge is rejected');
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-1'), repeat('x',40))$$,
  '42501', 'not_authorized', 'A different controller token is rejected');
reset role;

select test_support.as_actor('member');
set local role service_role;
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-1'), repeat('s',40))$$,
  '42501', 'not_authorized', 'Another player cannot read a source even with the token');
reset role;

select test_support.as_actor('owner');
update private.attempt_sessions set revoked_at = clock_timestamp(), revocation_reason = 'terminal'
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime);
set local role service_role;
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-alphabet-1'), repeat('s',40))$$,
  '42501', 'not_authorized', 'A revoked session is rejected');
reset role;

select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('f',40)));
select test_support.run('prepare_interaction');
set local role service_role;
select throws_ok($$select private.read_alphabet_answer_hint_source(
  (select (state->>'attemptId')::uuid from test_support.runtime), test_support.id('item-flash-1'), repeat('f',40))$$,
  '42501', 'not_authorized', 'Other game modes cannot read Alphabet sources');
reset role;

select ok(not exists (select 1 from private.command_requests
  where result ? 'correctAnswer' or result ? 'principal_answer' or result ? 'answerLength'), 'Hint reads do not alter cached command results');
select * from finish();
rollback;
