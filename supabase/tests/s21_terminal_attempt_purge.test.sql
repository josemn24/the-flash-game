begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

create temporary table purge_case (attempt uuid, scope jsonb, preparation uuid, replacement uuid);
grant all on purge_case to service_role;
grant select on purge_case to authenticated;
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')));
insert into purge_case (attempt,scope) select (state->>'attemptId')::uuid, jsonb_build_object(
 'attemptId',state->>'attemptId','roomId',test_support.id('room-flash'),'scheduledChallengeId',test_support.id('sc-flash'))
 from test_support.runtime;
select throws_ok('select private.purge_terminal_attempt(scope) from purge_case',
 '42501','not_authorized','An ordinary player cannot purge');
select test_support.as_actor('superadmin');
select throws_ok('select private.purge_terminal_attempt(scope) from purge_case',
 '55000','attempt_not_terminal','An attempt in progress cannot be purged');
select throws_ok('delete from public.attempts','42501',null,'The service cannot delete attempts directly');
select test_support.as_actor('member');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":50}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select test_support.run('record_evaluation','{"status":"correct","points":50}');
select test_support.run('complete_attempt');
update purge_case set preparation=(private.issue_attempt_start(test_support.id('sc-flash'),attempt,repeat('p',40),null)->>'preparationId')::uuid;
select test_support.as_actor('superadmin');
select private.adjust_result(jsonb_build_object('idempotencyKey','purge-test-adjust','attemptId',attempt,
 'lockVersion',(select a.lock_version from public.attempts a where a.id=attempt),'score',40,'reason','Fixture')) from purge_case;
select throws_ok(format('select private.purge_terminal_attempt(%L)',(select scope || jsonb_build_object(
 'roomId',test_support.id('room-narrative'),'scheduledChallengeId',test_support.id('sc-narrative')) from purge_case)),
 '42501','not_authorized','Scope must match the exact attempt');
reset role;
select throws_ok('delete from public.attempts','P0001','Historical records cannot be overwritten or deleted',
 'A direct delete still triggers historical protection');
insert into private.room_measurement_events(measurement_id,event_id,player_id,publication_id,type,visit_id,occurred_at,app_version,attempt_id)
select m.id,gen_random_uuid(),test_support.id('member'),test_support.id('sc-flash'),v.type,gen_random_uuid(),clock_timestamp(),'test',
 case when v.linked then (select attempt from purge_case) end
from private.room_measurements m cross join (values ('review_viewed', true),('review_viewed', false),('challenge_intro_viewed', false)) v(type,linked)
where m.season_id=test_support.id('season-flash');
insert into private.room_measurement_ratings(measurement_id,id,player_id,publication_id,value,attempt_id)
select m.id,gen_random_uuid(),test_support.id('member'),test_support.id('sc-flash'),5,
 case when linked then (select attempt from purge_case) end
from private.room_measurements m cross join (values(true),(false)) v(linked) where m.season_id=test_support.id('season-flash');

-- Force a failure after child deletion to prove it rolls the whole purge back.
create function test_support.fail_purge() returns trigger language plpgsql as $$
begin raise exception 'forced purge failure'; end $$;
create trigger z_fail_purge before delete on public.attempts for each row execute function test_support.fail_purge();
set local role service_role;
select throws_ok('select private.purge_terminal_attempt(scope) from purge_case','P0001','forced purge failure',
 'Failure at parent delete rolls back the earlier writes');
reset role;
drop trigger z_fail_purge on public.attempts;
select is((select count(*) from private.attempt_answers where attempt_id=(select attempt from purge_case)),2::bigint,
 'Rollback kept both answers');
set local role service_role;
select is((select private.purge_terminal_attempt(scope) from purge_case),'commands-flash','The operator purges the completed attempt');
reset role;
select ok(not exists(select 1 from public.attempts a where a.id=(select attempt from purge_case))
 and not exists(select 1 from private.attempt_answers)
 and not exists(select 1 from private.attempt_sessions)
 and not exists(select 1 from private.answer_receipts)
 and not exists(select 1 from private.attempt_timing_units)
 and not exists(select 1 from private.interaction_intervals)
 and not exists(select 1 from private.flash_point_entries)
 and not exists(select 1 from private.audit_log where entity_type='attempt')
 and not exists(select 1 from private.command_requests where input->>'attemptId'=(select attempt::text from purge_case)
   or result->>'attemptId'=(select attempt::text from purge_case)),
 'The attempt and linked gameplay, scoring, audit and retry records were removed');
select is((select count(*) from private.room_measurement_ratings),0::bigint,'Purges linked and legacy ratings');
select is((select array_agg(type) from private.room_measurement_events),array['challenge_intro_viewed'],
 'Purges linked and legacy review events while preserving introduction telemetry');
select test_support.as_actor('member');
set local role authenticated;
select is((select count(*) from public.get_challenge_ranking(test_support.id('sc-flash'))),0::bigint,
 'The purged result is gone from the challenge ranking');
select ok(not public.record_room_measurement_event(jsonb_build_object(
 'eventId',gen_random_uuid(),'visitId',gen_random_uuid(),'roomId','commands-flash',
 'publicationId',test_support.id('sc-flash'),'type','review_viewed','attemptId',(select attempt from purge_case),
 'occurredAt',clock_timestamp(),'appVersion','test')), 'A late review cannot restore a trace');
select throws_ok(format('select public.save_my_season_rating(%L)',jsonb_build_object(
 'id',gen_random_uuid(),'publicationId',test_support.id('sc-flash'),'seasonId',test_support.id('season-flash'),
 'attemptId',(select attempt from purge_case),'value',5)),
 '42501','not_authorized','A late rating cannot restore a trace');
reset role;
set local role service_role;
select throws_ok(format('select private.start_prepared_attempt(%L)',(select jsonb_build_object(
 'scheduledChallengeId',test_support.id('sc-flash'),'preparationId',preparation,
 'idempotencyKey','purge-test-stale','sessionToken',repeat('p',40)) from purge_case)),
 '55000','attempt_session_missing','A preparation issued before deletion cannot start another attempt');
select throws_ok(format('select private.issue_attempt_start(%L,%L,%L,null)',
 test_support.id('sc-flash'),(select attempt from purge_case),repeat('f',40)),
 '55000','attempt_session_missing','Recovery cannot prepare a replacement');
update purge_case set preparation=(private.issue_attempt_start(test_support.id('sc-flash'),null,repeat('f',40),null)->>'preparationId')::uuid;
update purge_case set replacement=(private.start_prepared_attempt(jsonb_build_object(
 'scheduledChallengeId',test_support.id('sc-flash'),'preparationId',preparation,
 'idempotencyKey','purge-test-fresh','sessionToken',repeat('f',40)))->>'attemptId')::uuid;
select ok((select replacement<>attempt from purge_case),'Fresh preparation creates a new attempt ID');
select test_support.as_actor('superadmin');
select is((select private.purge_terminal_attempt(scope) from purge_case),'commands-flash','Repeating the old purge succeeds');
reset role;
select is((select status from public.attempts a join purge_case c on a.id=c.replacement),'in_progress',
 'Repeating the old purge keeps the replacement untouched');

-- The other modes use the same purge and inspector boundary. Abandoning is legal in all modes.
select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-'||mode),'sessionToken',md5(mode)||md5(mode)))
from unnest(array['alphabet','survival','narrative','pyramid']) mode;
-- Set up each terminal attempt using its actual session and revision.
reset role;
create temporary table other_cases as
select a.id, a.lock_version, r.id room_id, p.id publication_id, cv.mode
from public.attempts a join public.scheduled_challenges p on p.id=a.scheduled_challenge_id
join public.seasons s on s.id=p.season_id join public.rooms r on r.id=s.room_id
join private.challenge_versions cv on cv.id=a.challenge_version_id where a.player_id=test_support.id('member2');
grant select on other_cases to service_role;
set local role service_role;
select private.abandon_attempt(jsonb_build_object('attemptId',id,'lockVersion',lock_version,
 'idempotencyKey','purge-abandon-'||mode,'sessionToken',md5(mode)||md5(mode))) from other_cases;
select test_support.start_ct(1);
select test_support.solve_ct();
select test_support.run('abandon_attempt');
reset role;
insert into other_cases
select a.id,a.lock_version,test_support.id('ct-room-1'),a.scheduled_challenge_id,'time-trial'
from public.attempts a where a.scheduled_challenge_id=test_support.id('ct-sc-1');
select is((select count(*) from private.queens_validation_events),1::bigint,'The Contrarreloj fixture records a format event');
update public.scheduled_challenges set status='closed' where id=test_support.id('ct-sc-1');
select test_support.as_actor('superadmin');
select ok((public.get_superadmin_attempt_publications(test_support.id('room-narrative'))->'entries')
 @> '[{"mode":"narrative"}]'::jsonb,'Narrative appears in the inspector');
select ok((select public.get_superadmin_attempt_inspection(room_id,publication_id,id) is not null
 from other_cases where mode='narrative'),'Narrative detail is inspectable');
set local role service_role;
select private.invalidate_attempt(jsonb_build_object('attemptId',id,'lockVersion',lock_version+1,
 'idempotencyKey','purge-test-invalidate','reason','Fixture')) from other_cases where mode='narrative';
select lives_ok(format('select private.purge_terminal_attempt(%L)',jsonb_build_object(
 'attemptId',id,'roomId',room_id,'scheduledChallengeId',publication_id)), 'Can purge '||mode)
from other_cases order by mode;
reset role;
select is((select count(*) from public.attempts a join other_cases c using(id)),0::bigint,'All terminal modes were purged');
select is((select count(*) from private.queens_validation_events),0::bigint,'The format event was purged');
select test_support.as_actor('member2');
set local role service_role;
update purge_case set preparation=(private.issue_attempt_start(test_support.id('ct-sc-1'),null,repeat('p',40),null)->>'preparationId')::uuid;
select throws_ok(format('select private.start_prepared_attempt(%L)',(select jsonb_build_object(
 'scheduledChallengeId',test_support.id('ct-sc-1'),'preparationId',preparation,
 'idempotencyKey','purge-test-closed','sessionToken',repeat('p',40)) from purge_case)),
 'P0001','No competitive access or publication unavailable','A purged closed publication still rejects a fresh start');
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet-fast'),'sessionToken',repeat('x',40)));
update purge_case set scope=jsonb_build_object(
 'attemptId',(select state->>'attemptId' from test_support.runtime),
 'roomId',test_support.id('room-alphabet-fast'),'scheduledChallengeId',test_support.id('sc-alphabet-fast'));
select pg_sleep(0.15);
select test_support.as_actor('superadmin');
select throws_ok('select private.purge_terminal_attempt(scope) from purge_case',
 '55000','attempt_not_terminal','A passed deadline does not implicitly close a persisted active attempt');
reset role;
select * from finish();
rollback;
