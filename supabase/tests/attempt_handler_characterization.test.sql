-- Expectations established against 20261014203717_maintenance_rpc before extraction.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

create function test_support.command_error(statement text) returns jsonb language plpgsql as $$
declare detail text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics detail = pg_exception_detail;
  return jsonb_build_object('state', sqlstate, 'message', sqlerrm, 'detail', detail);
end;
$$;
create function test_support.command_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'attempts', (select jsonb_agg(to_jsonb(a) order by id) from public.attempts a),
    'sessions', (select jsonb_agg(to_jsonb(a) order by id) from private.attempt_sessions a),
    'units', (select jsonb_agg(to_jsonb(a) order by id) from private.attempt_timing_units a),
    'intervals', (select jsonb_agg(to_jsonb(a) order by id) from private.interaction_intervals a),
    'prepared', (select jsonb_agg(to_jsonb(a) order by attempt_id) from private.prepared_interactions a),
    'receipts', (select jsonb_agg(to_jsonb(a) order by id) from private.answer_receipts a),
    'answers', (select jsonb_agg(to_jsonb(a) order by id) from private.attempt_answers a),
    'entries', (select jsonb_agg(to_jsonb(a) order by id) from private.flash_point_entries a),
    'audit', (select jsonb_agg(to_jsonb(a) order by id) from private.audit_log a),
    'commands', (select jsonb_agg(to_jsonb(a) order by actor_id, idempotency_key) from private.command_requests a)
  )
$$;
create function test_support.assert_replay(label text) returns setof text language plpgsql as $$
declare before_state jsonb := test_support.command_snapshot();
begin
  return next is(test_support.repeat_last(), (select last_result from test_support.runtime), label || ': exact replay');
  return next is(test_support.command_snapshot(), before_state, label || ': replay has no writes');
end;
$$;

select test_support.as_actor('owner');
select is(test_support.command_error($$select private.execute_command('start', null)$$),
  '{"state":"22023","message":"invalid_command","detail":""}'::jsonb, 'SQL NULL input contract');
select is(test_support.command_error($$select private.execute_command('start', 'null')$$),
  '{"state":"22023","message":"invalid_command","detail":""}'::jsonb, 'JSON null input contract');
select throws_ok($$select private.execute_command('unknown', '{}')$$, '22023', 'unknown_command', 'Unknown operation precedes envelope validation');
select throws_ok($$select private.execute_command('start', '{"idempotencyKey":"missing","sessionToken":"ssssssssssssssssssssssssssssssssssssssss"}')$$,
  '22023', 'invalid_command', 'Missing publication is rejected');
select throws_ok($$select private.execute_command('start', '{"idempotencyKey":"null","scheduledChallengeId":null,"sessionToken":"ssssssssssssssssssssssssssssssssssssssss"}')$$,
  '22023', 'invalid_command', 'JSON null publication is rejected');

select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash')));
select is((select (last_result->>'lockVersion')::integer from test_support.runtime), 1, 'Start version is one');
select * from test_support.assert_replay('start');
select throws_ok($$select test_support.repeat_last('{"sessionToken":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}')$$,
  '40001', 'idempotency_conflict', 'Changed payload conflicts before replay');
select test_support.run('start_attempt');
select is((select last_result->>'resumed' from test_support.runtime), 'true', 'Fresh start resumes existing attempt');
select is((select count(*) from private.attempt_sessions), 1::bigint, 'Resume keeps the original session');
select test_support.run('prepare_interaction');
select * from test_support.assert_replay('prepare');
select throws_ok($$select test_support.run('receive_answer', '{"answer":true,"lockVersion":1,"sessionToken":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}')$$,
  '42501', 'session_revoked', 'Session rejection precedes stale version');
select throws_ok($$select test_support.run('receive_answer', '{"lockVersion":1}')$$,
  '22023', 'invalid_command', 'Missing answer precedes version validation');

create function test_support.reject_characterization_audit() returns trigger language plpgsql as $$
begin raise exception 'characterization_audit_failure'; end;
$$;
create trigger characterization_audit before insert on private.audit_log
  for each row execute function test_support.reject_characterization_audit();
create temporary table characterization_before as select test_support.command_snapshot() as state;
select throws_ok($$select test_support.run('receive_answer', '{"answer":null}')$$,
  'P0001', 'characterization_audit_failure', 'Audit failure rejects receipt');
select is(test_support.command_snapshot(), (select state from characterization_before), 'Failed receipt rolls back intervals, receipt, activity, version and idempotency');
drop trigger characterization_audit on private.audit_log;

select test_support.run('receive_answer', '{"answer":null,"clientTimeUsedMs":999999}');
select ok((select answer is not null and answer = 'null'::jsonb from private.answer_receipts), 'Explicit JSON null answer is persisted as JSON null');
select * from test_support.assert_replay('receive');
select throws_ok($$select test_support.run('prepare_interaction')$$, '55000', 'evaluation_pending', 'Pending evaluation blocks next question');
select test_support.run('record_evaluation', '{"status":"unanswered","points":0}');
select * from test_support.assert_replay('evaluate');
select test_support.run('prepare_interaction');
select test_support.run('take_over_attempt', jsonb_build_object('newSessionToken', repeat('t', 40)));
select * from test_support.assert_replay('takeover');
select throws_ok($$select test_support.run('receive_answer', '{"answer":true,"sessionToken":"ssssssssssssssssssssssssssssssssssssssss"}')$$,
  '42501', 'session_transferred', 'Old controller cannot answer');
select test_support.run('receive_answer', '{"answer":true}');
select test_support.run('record_evaluation', '{"status":"correct","points":23}');
select is(test_support.run('complete_attempt')->>'score', '23', 'Completion uses accepted points');
select * from test_support.assert_replay('complete');
select test_support.as_actor('superadmin');
select is(test_support.run('adjust_result', '{"score":40,"reason":"characterization"}')->>'effectiveScore', '40', 'Adjustment changes effective balance');
select * from test_support.assert_replay('adjust');
select is(test_support.run('invalidate_attempt', '{"reason":"characterization"}')->>'effectiveScore', '0', 'Invalidation reverses effective balance');
select * from test_support.assert_replay('invalidate');
select is((select score from public.attempts), 23, 'Administrative commands preserve original score');

-- Exercise the dispatcher activate branch directly: the production facade has its own implementation.
create function test_support.dispatch_activate() returns jsonb language plpgsql as $$
declare body jsonb; result jsonb;
begin
  select jsonb_build_object('idempotencyKey', gen_random_uuid(), 'attemptId', state->'attemptId',
    'lockVersion', state->'lockVersion', 'sessionToken', state->'sessionToken', 'challengeItemId', state->'challengeItemId')
    into body from test_support.runtime;
  result := private.execute_command('activate', body);
  update test_support.runtime set state = state || result;
  return result;
end;
$$;
create function test_support.characterize_mode(mode_name text) returns setof text language plpgsql as $$
declare initial_version bigint; prepared_version bigint; target uuid; result jsonb;
begin
  perform test_support.as_actor('member');
  if mode_name = 'time-trial' then
    perform test_support.start_ct(1, false);
  else
    perform test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-' || mode_name), 'sessionToken', gen_random_uuid()::text));
  end if;
  select (state->>'attemptId')::uuid, (state->>'lockVersion')::bigint into target, initial_version from test_support.runtime;
  perform test_support.run('prepare_interaction');
  select (state->>'lockVersion')::bigint into prepared_version from test_support.runtime;
  return next is(prepared_version, initial_version + case when mode_name = 'time-trial' then 2 else 1 end, mode_name || ': exact preparation version delta');
  return query select * from test_support.assert_replay(mode_name || ' prepare');
  if mode_name = 'pyramid' then
    return next is((select count(*) from private.attempt_timing_units where attempt_id = target), 0::bigint, 'Pyramid prepare does not start clock');
    result := test_support.dispatch_activate();
    return next is((result->>'lockVersion')::bigint, prepared_version + 1, 'Dispatcher activation increments once');
  end if;
  return next ok((select bool_and(deadline_at > started_at) from private.attempt_timing_units where attempt_id = target), mode_name || ': valid persisted clocks');
  select (state->>'lockVersion')::bigint into prepared_version from test_support.runtime;
  result := test_support.run('abandon_attempt');
  return next is((result->>'lockVersion')::bigint, prepared_version + 1, mode_name || ': abandonment increments once');
  return next is(result->>'score', null::text, mode_name || ': abandoned score is null');
  return next is((select count(*) from private.flash_point_entries where attempt_id = target), 0::bigint, mode_name || ': abandonment has no credit');
  return query select * from test_support.assert_replay(mode_name || ' abandon');
end;
$$;
select * from test_support.characterize_mode('flash');
select * from test_support.characterize_mode('alphabet');
select * from test_support.characterize_mode('survival');
select * from test_support.characterize_mode('narrative');
select * from test_support.characterize_mode('pyramid');
select * from test_support.characterize_mode('time-trial');

select test_support.as_actor('member2');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-alphabet'), 'sessionToken', gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select is(test_support.run('pass_interaction')->>'passed', 'true', 'Alphabet pass closes the visit');
select * from test_support.assert_replay('pass');
select test_support.as_actor('outsider');
select is(test_support.run('accept_invitation', jsonb_build_object('invitationToken', repeat('i', 40)))->>'joined', 'true', 'Invitation grants membership');
select * from test_support.assert_replay('invitation');

set constraints all immediate;
select * from finish();
rollback;
