begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r' and
  has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')), 'Service has no direct DML');
create table public.future_table(id bigint generated always as identity);
create function public.future_function() returns integer language sql as $$ select 1 $$;
create view public.future_view as select * from public.future_table;
select ok(not has_table_privilege('anon','public.future_table','SELECT') and not has_table_privilege('authenticated','public.future_view','SELECT'), 'Future tables/views receive no API grants');
select ok(not has_function_privilege('anon','public.future_function()','EXECUTE') and not has_function_privilege('service_role','public.future_function()','EXECUTE'), 'Future functions receive no API/PUBLIC execute');
select ok(not has_sequence_privilege('authenticated','public.future_table_id_seq','USAGE'), 'Future sequences receive no API grants');
set local role authenticated;
select throws_ok($$select private.start_attempt('{}')$$,'42501',null,'Browser cannot call server commands');
reset role;
select test_support.as_actor('owner');
set local role service_role;
select throws_ok($$insert into public.attempts default values$$,'42501',null,'Service cannot insert attempts');
select throws_ok($$update public.attempts set score=100$$,'42501',null,'Service cannot update attempts');
select throws_ok($$delete from private.flash_point_entries$$,'42501',null,'Service cannot delete ledger');
select throws_ok($$select private.execute_command('start','{}')$$,'42501',null,'Generic dispatcher is not callable');
select lives_ok($$select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')))$$,'Start command creates attempt/session/audit');
select is((select (state->>'deadlineAt') from test_support.runtime),null::text,'Flash has no artificial global deadline');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Start retry returns identical result');
select throws_ok($$select test_support.repeat_last('{"sessionToken":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}')$$,'40001',null,'Same key with changed payload conflicts');
select throws_ok($$select test_support.run('receive_answer',jsonb_build_object('challengeItemId',test_support.id('item-flash-1'),'answer',true))$$,'55000',null,'Answer without presentation is rejected');
select lives_ok($$select test_support.run('prepare_interaction')$$,'Preparation persists clock before payload');
select is((select (last_result->>'payloadSchemaVersion')::integer from test_support.runtime),1,
  'Preparation returns the question payload schema version');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Prepare retry preserves clock and version');
select throws_ok($$select test_support.run('receive_answer','{"answer":true,"presentedAt":"2000-01-01T00:00:00Z"}')$$,'22023',null,'Client cannot supply presentedAt');
select throws_ok($$select test_support.run('receive_answer','{"answer":true,"timeUsedMs":0}')$$,'22023',null,'Client cannot supply competitive time');
select throws_ok($$select test_support.run('receive_answer','{"answer":true,"lockVersion":1}')$$,'40001',null,'Stale version is rejected');
select lives_ok($$select test_support.run('receive_answer','{"answer":true,"clientTimeUsedMs":999999999}')$$,'Reception accepts optional telemetry');
select ok((select (last_result->>'timeUsedMs')::bigint<999999999 from test_support.runtime),'Telemetry does not determine authoritative duration');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Repeated reception returns same receipt');
select throws_ok($$select test_support.run('prepare_interaction')$$,'55000',null,'Cannot reveal next question before evaluating receipt');
select pg_sleep(0.02);
select lives_ok($$select test_support.run('record_evaluation','{"status":"correct","points":50}')$$,'Delayed evaluation uses recorded reception');
select lives_ok($$select test_support.run('prepare_interaction')$$,'Next question becomes available after evaluation');
select lives_ok($$select test_support.run('take_over_attempt','{"newSessionToken":"nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn"}')$$,'Explicit takeover succeeds');
select throws_ok($$select test_support.run('receive_answer','{"answer":true,"sessionToken":"ssssssssssssssssssssssssssssssssssssssss"}')$$,'42501',null,'Revoked token cannot submit');
select lives_ok($$select test_support.run('receive_answer','{"answer":true}')$$,'New session continues existing interaction');
select lives_ok($$select test_support.run('record_evaluation','{"status":"correct","points":50}')$$,'Second answer evaluated');
select lives_ok($$select test_support.run('complete_attempt','{"score":100}')$$,'Completion credits and revokes atomically');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Completion retry works after session revocation');
reset role;
select is((select count(*) from private.flash_point_entries),1::bigint,'Exactly one accreditation');
select is((select count(*) from private.attempt_sessions where revoked_at is null),0::bigint,'Terminal attempt has no controlling session');
select ok(not exists(select 1 from private.command_requests where input::text like '%ssssssssssssssss%' or result::text like '%nnnnnnnnnnnnnnnn%'),'Idempotency records never retain raw tokens');
select is((select count(*) from private.audit_log where action='complete'),1::bigint,'Completion has exactly one audit event');
select test_support.as_actor('superadmin');
set local role service_role;
select lives_ok($$select test_support.run('adjust_result','{"score":60,"reason":"test correction"}')$$,'Superadmin correction is transactional');
select throws_ok($$select test_support.run('invalidate_attempt','{"reason":""}')$$,'22023',null,'Invalidation requires a reason');
select lives_ok($$select test_support.run('invalidate_attempt','{"reason":"test invalidation"}')$$,'Invalidation reverses effective balance and audits');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Invalidation retry does not duplicate reversal');
reset role;
select is((select sum(amount) from private.flash_point_entries),0::bigint,'Invalidated balance is zero');
select is((select count(*) from private.audit_log where action='invalidate'),1::bigint,'Invalidation audit exists');
select is((select score from public.attempts limit 1),100,'Original score is preserved');

-- Alfabeto visits share a deadline; passing creates intervals, not final answers.
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet'),'sessionToken',repeat('a',40)));
select test_support.run('prepare_interaction');
select test_support.run('pass_interaction');
select test_support.run('prepare_interaction');
select test_support.run('pass_interaction');
select test_support.run('prepare_interaction');
reset role;
select is((select count(distinct deadline_at) from private.attempt_timing_units where scope='attempt'),1::bigint,'Alphabet visits share global deadline');
select is((select count(*) from private.interaction_intervals where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),3::bigint,'Returning to a letter creates another interval');
select is((select count(*) from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0::bigint,'Passing does not create final answers');
set local role service_role;
select test_support.run('receive_answer','{"answer":true}');
reset role;
select is((select r.time_used_ms from private.answer_receipts r where r.id=(select (state->>'receiptId')::uuid from test_support.runtime)),
  (select sum(floor(extract(epoch from (x.ended_at-x.started_at))*1000))::bigint from private.interaction_intervals x
    where x.attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime) and x.challenge_item_id=test_support.id('item-alphabet-1')),
  'Alphabet sums only distinct visits to this letter, excluding other letters and transitions');
set local role service_role;
select test_support.run('record_evaluation','{"status":"correct","points":50}');
select test_support.run('abandon_attempt');
reset role;
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0::bigint,'Abandonment earns no points');

-- Late reception cannot be converted into an on-time answer by fast/slow evaluation.
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-fast'),'sessionToken',repeat('f',40)));
select test_support.run('prepare_interaction');
select pg_sleep(0.03);
select test_support.run('receive_answer','{"answer":null,"clientTimeUsedMs":0}');
select is((select (last_result->>'timedOut')::boolean from test_support.runtime),true,'Late reception is marked timeout');
select is((select (last_result->>'timeUsedMs')::bigint from test_support.runtime),10::bigint,'Timeout duration is capped by published question limit');
select test_support.run('record_evaluation','{"status":"unanswered","points":0}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select is((select (last_result->>'timedOut')::boolean from test_support.runtime),false,'Immediate answer arrives before the short deadline');
select pg_sleep(0.03);
select lives_ok($$select test_support.run('record_evaluation','{"status":"correct","points":50}')$$,'Slow evaluation after question deadline accepts the timely persisted reception');
select test_support.run('abandon_attempt');
reset role;

-- Inject a database failure after changes but before audit/command commit.
create function test_support.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'injected audit failure'; end $$;
create trigger test_fail_audit before insert on private.audit_log for each row execute function test_support.fail_audit();
select test_support.as_actor('outsider');
set local role service_role;
select throws_ok($$select test_support.run('accept_invitation',jsonb_build_object('invitationToken',repeat('i',40)))$$,'P0001',null,'Audit failure aborts invitation transaction');
reset role;
select is((select use_count from private.room_invitations),0,'Failed command does not consume invitation');
select is((select count(*) from public.room_memberships where player_id=test_support.id('outsider')),0::bigint,'Failed command does not create membership');
drop trigger test_fail_audit on private.audit_log;
set local role service_role;
select lives_ok($$select test_support.run('accept_invitation',jsonb_build_object('invitationToken',repeat('i',40)))$$,'Invitation acceptance succeeds after transient failure');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Invitation retry does not consume another use');
reset role;
select is((select use_count from private.room_invitations),1,'One invitation use recorded');
set constraints all immediate;
select * from finish();
rollback;
