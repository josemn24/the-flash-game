begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

-- Trusted fixture facts at exact timestamps exercise the integrity boundary and
-- comparator without relying on scheduling jitter to create a millisecond tie.
create function test_support.ct_answer_at(received timestamptz, answer_status text default 'correct', awarded integer default null) returns void language plpgsql as $$
declare a public.attempts%rowtype; segment private.interaction_intervals%rowtype; receipt private.answer_receipts%rowtype; weight integer; elapsed bigint;
begin
  select * into a from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime);
  select * into segment from private.interaction_intervals where attempt_id=a.id and ended_at is null;
  select points into weight from private.challenge_items where id=segment.challenge_item_id;
  elapsed:=greatest(0,floor(extract(epoch from (least(received,a.deadline_at)-segment.started_at))*1000))::bigint;
  insert into private.answer_receipts(attempt_id,challenge_item_id,challenge_version_id,answer,received_at,presented_at,effective_submitted_at,time_used_ms,timed_out)
  values(a.id,segment.challenge_item_id,a.challenge_version_id,'{"queens":[2,9,10,18,21]}',received,segment.started_at,least(received,a.deadline_at),elapsed,false)
  returning * into receipt;
  update private.interaction_intervals set ended_at=least(received,a.deadline_at),end_reason='answer' where id=segment.id;
  insert into private.attempt_answers(attempt_id,challenge_item_id,challenge_version_id,receipt_id,status,answer,points,presented_at,submitted_at,time_used_ms,idempotency_key)
  values(a.id,segment.challenge_item_id,a.challenge_version_id,receipt.id,answer_status,receipt.answer,coalesce(awarded,weight),segment.started_at,receipt.effective_submitted_at,elapsed,gen_random_uuid()::text);
end;
$$;
select test_support.as_actor('owner');
set local role service_role;
select test_support.start_ct(9);
reset role;
select throws_ok($$select test_support.ct_answer_at((select deadline_at from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)))$$,'P0001','Invalid Contrarreloj score','A receipt exactly at the deadline cannot earn points');
select throws_ok($$select test_support.ct_answer_at((select deadline_at+interval '1 microsecond' from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)))$$,'P0001','Invalid Contrarreloj score','A receipt after the deadline cannot earn points');
select throws_ok($$select test_support.ct_answer_at(clock_timestamp(),'partial',15)$$,'P0001','Invalid Contrarreloj score','SQL rejects partial credit');
select throws_ok($$select test_support.ct_answer_at(clock_timestamp(),'correct',29)$$,'P0001','Invalid Contrarreloj score','SQL rejects a weight different from the published allocation');
select lives_ok($$select test_support.ct_answer_at((select deadline_at-interval '1 microsecond' from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)))$$,'A receipt immediately before the deadline earns its full weight');

create function test_support.ct_ranked_result(actor text, last_ms integer) returns void language plpgsql as $$
declare began timestamptz;
begin
  perform test_support.as_actor(actor);
  perform test_support.start_ct(11);
  select deadline_at-interval '60 seconds' into began from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime);
  perform pg_sleep(0.25);
  perform test_support.ct_answer_at(began+interval '200 milliseconds');
  perform test_support.run('prepare_interaction');
  perform pg_sleep(last_ms/1000.0);
  perform test_support.ct_answer_at(began+last_ms*interval '1 millisecond');
  perform test_support.run('complete_attempt','{"score":0}');
end;
$$;
select test_support.ct_ranked_result('owner',900);
select test_support.ct_ranked_result('member',900);
select test_support.ct_ranked_result('member2',1800);
set local role authenticated;
select is((select array_agg(position order by position,player_id) from public.get_challenge_ranking(test_support.id('ct-sc-11'))),array[1,1,3]::bigint[],'Equal solved count and last-correct time share positions 1,1,3');
select is((select array_agg(last_correct_elapsed_ms order by position,player_id) from public.get_challenge_ranking(test_support.id('ct-sc-11'))),array[900,900,1800]::bigint[],'Ranking includes the elapsed global time, including the transition');
reset role;
update public.scheduled_challenges set status='closed' where id=test_support.id('ct-sc-11');
set local role authenticated;
select is((select array_agg(position order by position,player_id) from public.get_room_history('ct-room-11',test_support.id('ct-sc-11'))),array[1,1,3]::bigint[],'History uses exactly the same competitive comparator');
reset role;

select test_support.as_actor('member');
set local role service_role;
select test_support.start_ct(12);
select test_support.solve_ct();
select test_support.run('prepare_interaction');
reset role;
select test_support.as_actor('owner');
set local role authenticated;
select public.manage_room_member(jsonb_build_object('roomKey','ct-room-12','targetPlayerId',test_support.id('member'),'action','remove','idempotencyKey',gen_random_uuid()));
reset role;
select is((select terminal_reason from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),'permission_revoked','Losing permission uses the common terminal lifecycle');
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0::bigint,'Losing permission never accredits earlier points');
select * from finish();
rollback;
