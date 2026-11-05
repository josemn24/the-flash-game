begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

create function test_support.assert_completion_total(label text, expected integer) returns setof text
language plpgsql as $$
declare target uuid := (select (state->>'attemptId')::uuid from test_support.runtime);
begin
  return next is((select (last_result->>'score')::integer from test_support.runtime), expected, label || ': response total');
  return next is((select score from public.attempts where id=target), expected, label || ': persisted total');
  return next is((select coalesce(sum(points),0)::integer from private.attempt_answers where attempt_id=target), expected, label || ': accepted answers');
  return next is((select amount from private.flash_point_entries where attempt_id=target and entry_type='accreditation'), expected, label || ': ledger total');
  return next is(test_support.repeat_last(), (select last_result from test_support.runtime), label || ': exact replay');
  return next is((select count(*) from private.flash_point_entries where attempt_id=target and entry_type='accreditation'), 1::bigint, label || ': one credit including replay');
end;
$$;

select is(regexp_count(pg_get_functiondef('private.handle_attempt_closure(text,jsonb,public.attempts,public.scheduled_challenges,private.challenge_versions,timestamptz)'::regprocedure), 'sum\(answer.points\)'),
  1, 'The closure operation has a single completion aggregation for every mode');

select test_support.as_actor('member');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":13}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":23}');
create table test_support.before_completion as select
  (select to_jsonb(a) from public.attempts a where id=(select (state->>'attemptId')::uuid from test_support.runtime)) attempt,
  (select count(*) from private.audit_log) audits,
  (select count(*) from private.command_requests) commands;
select throws_ok($$select test_support.run('complete_attempt','{"score":100}')$$,
  '22023','invalid_command','The old score payload is rejected');
select is((select to_jsonb(a) from public.attempts a where id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  (select attempt from test_support.before_completion),'Rejected score leaves attempt and version unchanged');
select is((select count(*) from private.audit_log),(select audits from test_support.before_completion),'Rejected score creates no audit');
select is((select count(*) from private.command_requests),(select commands from test_support.before_completion),'Rejected score creates no idempotent result');
select is((select count(*) from private.flash_point_entries),0::bigint,'Rejected score creates no credit');
select ok(exists(select 1 from private.attempt_sessions where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime) and revoked_at is null),'Rejected score preserves the session');
select test_support.run('complete_attempt');
select * from test_support.assert_completion_total('Flash partial score',36);
select throws_ok($$select test_support.repeat_last('{"score":36}')$$,'22023','invalid_command','Even a replay rejects the old payload');

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-narrative'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":19}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select test_support.run('complete_attempt');
select * from test_support.assert_completion_total('Narrative partial score',19);

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-survival'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":12}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select is(test_support.run('complete_attempt')->>'outcome','eliminated','Survival retains elimination');
select * from test_support.assert_completion_total('Survival eliminated',12);

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":"A"}');
select test_support.run('record_evaluation','{"status":"correct","points":27}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":"A"}');
select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->>'receiptId' from test_support.runtime),'status','correct','points',31)));
select * from test_support.assert_completion_total('Alphabet includes pending evaluation',58);

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-pyramid'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('activate_interaction');
select test_support.run('receive_answer','{"answer":"A"}');
select test_support.run('record_evaluation','{"status":"correct","points":14}');
select test_support.run('prepare_interaction');
select test_support.run('activate_interaction');
select test_support.run('receive_answer','{"answer":"B"}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select is(test_support.run('complete_attempt')->>'outcome','failed','Pyramid retains failure');
select * from test_support.assert_completion_total('Pyramid failed after checkpoint',14);

select test_support.start_ct(11);
select test_support.solve_ct();
select test_support.run('prepare_interaction');
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,21]}');
select throws_ok($$select test_support.run('complete_attempt')$$,'55000','unfinished_interaction','Time Trial cannot close with unresolved receipt');
select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->>'receiptId' from test_support.runtime),'status','correct','points',70)));
select * from test_support.assert_completion_total('Time Trial includes pending evaluation',100);

select test_support.as_actor('member2');
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-survival'),'sessionToken',gen_random_uuid()::text));
do $$ begin
  for n in 1..2 loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('receive_answer','{"answer":true}');
    perform test_support.run('record_evaluation','{"status":"correct","points":20}');
  end loop;
end $$;
select is(test_support.run('complete_attempt')->>'outcome','survived','Survival retains success');
select * from test_support.assert_completion_total('Survival survived',40);

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-pyramid'),'sessionToken',gen_random_uuid()::text));
do $$ begin
  for n in 1..7 loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('activate_interaction');
    perform test_support.run('receive_answer','{"answer":"A"}');
    perform test_support.run('record_evaluation',jsonb_build_object('status','correct','points',case when n<6 then 14 else 15 end));
  end loop;
end $$;
select is(test_support.run('complete_attempt')->>'outcome','summit','Pyramid retains summit');
select * from test_support.assert_completion_total('Pyramid summit',100);

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',gen_random_uuid()::text));
do $$ begin
  for n in 1..2 loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('receive_answer','{"answer":false}');
    perform test_support.run('record_evaluation','{"status":"incorrect","points":0}');
  end loop;
end $$;
select test_support.run('complete_attempt');
select * from test_support.assert_completion_total('Zero score is still accredited once',0);

select test_support.as_actor('owner');
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',gen_random_uuid()::text));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":29}');
select test_support.run('abandon_attempt');
select is((select last_result->'score' from test_support.runtime),'null'::jsonb,'Abandonment keeps a null total');
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0::bigint,'Abandonment never accredits accepted points');

select * from finish();
rollback;
