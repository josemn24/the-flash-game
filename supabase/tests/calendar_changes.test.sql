begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures

insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('calendar-draft'),test_support.id('room-flash'),'Calendar draft','draft',
  date_trunc('minute',now())+interval '3 days 0.168123 seconds',date_trunc('minute',now())+interval '3 days 1 hour 0.168123 seconds');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,opens_at,closes_at)
select test_support.id('calendar-'||n),test_support.id('calendar-draft'),test_support.id('cv-flash'),n,
  date_trunc('minute',now())+interval '3 days 0.168123 seconds'+(n-1)*interval '5 minutes',
  date_trunc('minute',now())+interval '3 days 0.168123 seconds'+n*interval '5 minutes'
from generate_series(1,2) n;
set constraints all immediate;
set constraints all deferred;

create function pg_temp.calendar_input(target uuid, minutes integer default 0) returns jsonb language sql as $$
  select jsonb_build_object('seasonId',s.id,'expectedUpdatedAt',s.updated_at,
    'startsAt',s.starts_at+minutes*interval '1 minute','endsAt',s.ends_at+minutes*interval '1 minute',
    'publications',(select jsonb_agg(jsonb_build_object('scheduledChallengeId',p.id,'expectedUpdatedAt',p.updated_at,
      'opensAt',p.opens_at+minutes*interval '1 minute','closesAt',p.closes_at+minutes*interval '1 minute') order by p.number)
      from public.scheduled_challenges p where p.season_id=s.id)) from public.seasons s where s.id=target
$$;
grant execute on function pg_temp.calendar_input(uuid,integer) to authenticated;
select test_support.as_actor('superadmin');

select ok(not has_function_privilege('anon','public.apply_superadmin_calendar_change(jsonb)','EXECUTE'),'Anonymous cannot apply changes');
select ok(not has_function_privilege('service_role','public.apply_superadmin_calendar_change(jsonb)','EXECUTE'),'Service credential cannot impersonate an operator');
select set_config('calendar.original',pg_temp.calendar_input(test_support.id('calendar-draft'),5)::text,true);
select lives_ok($$select public.preview_superadmin_calendar_change(current_setting('calendar.original')::jsonb)$$,'Preview accepts a joint shift through existing windows');
select is((select opens_at from public.scheduled_challenges where id=test_support.id('calendar-1')),
  date_trunc('minute',now())+interval '3 days 0.168123 seconds','Preview preserves exact persisted microseconds');
select is((public.apply_superadmin_calendar_change(pg_temp.calendar_input(test_support.id('calendar-draft'))||
  '{"idempotencyKey":"calendar-noop","reason":"No changes"}')->>'changed')::boolean,false,'No-op leaves the domain untouched');
select is((select count(*) from private.audit_log where request_id='calendar-noop'),0::bigint,'No-op creates no domain audit event');
select lives_ok($$select public.apply_superadmin_calendar_change(current_setting('calendar.original')::jsonb||
  '{"idempotencyKey":"calendar-shift","reason":"Move the complete calendar"}')$$,'Joint shift commits without transient overlap');
select is((select opens_at from public.scheduled_challenges where id=test_support.id('calendar-1')),
  date_trunc('minute',now())+interval '3 days 5 minutes 0.168123 seconds','Shift preserves microseconds');
select lives_ok($$select public.apply_superadmin_calendar_change(current_setting('calendar.original')::jsonb||
  '{"idempotencyKey":"calendar-shift","reason":"Move the complete calendar"}')$$,'Exact retry replays the result');
select is((select count(*) from private.audit_log where request_id='calendar-shift'),1::bigint,'Joint shift writes one audit event');
select throws_ok($$select public.preview_superadmin_calendar_change(current_setting('calendar.original')::jsonb)$$,'40001','schedule_conflict','Stale preview is rejected');
select throws_ok($$select public.apply_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('calendar-draft')),
  '{publications,0,closesAt}',to_jsonb((select closes_at+interval '1 minute' from public.scheduled_challenges where id=test_support.id('calendar-1'))))||
  '{"idempotencyKey":"calendar-overlap","reason":"Invalid overlap"}')$$,'23P01','schedule_overlap','Final overlaps reject the whole proposal');
select is((select count(*) from private.audit_log where request_id='calendar-overlap'),0::bigint,'Rejected change leaves no audit event');
select throws_ok($$select public.preview_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('calendar-draft')),
  '{endsAt}',to_jsonb((select starts_at+interval '1 minute' from public.seasons where id=test_support.id('calendar-draft')))))$$,
  '23514','schedule_outside_season','Season cannot exclude its publications');

insert into public.attempts(player_id,scheduled_challenge_id,challenge_version_id,kind,client_state_schema_version)
values(test_support.id('superadmin'),test_support.id('calendar-1'),test_support.id('cv-flash'),'test',1);
select lives_ok($$select public.apply_superadmin_calendar_change(pg_temp.calendar_input(test_support.id('calendar-draft'),5)||
  '{"idempotencyKey":"calendar-after-test","reason":"A rehearsal does not freeze dates"}')$$,'Administrative test attempts do not freeze calendar dates');
select is((select count(*) from public.attempts where scheduled_challenge_id=test_support.id('calendar-1')),1::bigint,'Administrative test attempt is preserved');

select test_support.as_actor('member');
set local role authenticated;
select is((select count(*) from public.scheduled_challenges where season_id=test_support.id('calendar-draft')),0::bigint,'Draft calendar stays hidden through RLS');
reset role;
select throws_ok($$select public.preview_superadmin_calendar_change(pg_temp.calendar_input(test_support.id('calendar-draft')))$$,'42501','not_authorized','Room members cannot preview administrative changes');
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet')));
select ok((select deadline_at is not null from public.attempts where scheduled_challenge_id=test_support.id('sc-alphabet')),'A real individual clock is running');
select set_config('calendar.attempts_before',(select jsonb_agg(to_jsonb(a) order by id)::text from public.attempts a),true);
select set_config('calendar.sessions_before',(select jsonb_agg(to_jsonb(a) order by id)::text from private.attempt_sessions a),true);
select test_support.as_actor('superadmin');
select lives_ok($$select public.apply_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('season-alphabet')),
  '{publications,0,closesAt}',to_jsonb((select closes_at+interval '15 minutes' from public.scheduled_challenges where id=test_support.id('sc-alphabet'))))||
  '{"idempotencyKey":"calendar-extend-live","reason":"Extend the shared closing window"}')$$,'An open challenge with competitive attempts can extend its closing');
select is((select jsonb_agg(to_jsonb(a) order by id)::text from public.attempts a),current_setting('calendar.attempts_before'),'Started attempts and individual deadlines are unchanged');
select is((select jsonb_agg(to_jsonb(a) order by id)::text from private.attempt_sessions a),current_setting('calendar.sessions_before'),'Existing sessions are unchanged');
select throws_ok($$select public.preview_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('season-flash')),
  '{startsAt}',to_jsonb(now()-interval '3 days')))$$,'55000','season_start_locked','Competition freezes the season start');
select throws_ok($$select public.preview_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('season-survival')),
  '{publications,0,opensAt}',to_jsonb(now()+interval '1 hour')))$$,'55000','opening_reached','Opening is frozen even when nobody has played');
select throws_ok($$select public.preview_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('season-survival')),
  '{publications,0,closesAt}',to_jsonb(now()+interval '1 hour')))$$,'55000','opening_reached','An open window cannot be shortened');
select lives_ok($$select public.preview_superadmin_calendar_change(jsonb_set(pg_temp.calendar_input(test_support.id('season-survival')),
  '{publications,0,closesAt}',to_jsonb(now()+interval '25 hours')))$$,'An open window without attempts can be extended');
select throws_ok($$select public.update_superadmin_season(jsonb_build_object(
  'idempotencyKey','calendar-stale-title','seasonId',test_support.id('calendar-draft'),'title','Edited draft',
  'expectedUpdatedAt','2000-01-01T00:00:00Z','startsAt',(select starts_at from public.seasons where id=test_support.id('calendar-draft')),
  'endsAt',(select ends_at from public.seasons where id=test_support.id('calendar-draft')),'reason','Stale title form'))$$,
  '40001','schedule_conflict','The existing title form cannot overwrite a concurrent calendar change');
-- A past planning window remains editable until its season is published.
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('calendar-past-draft'),test_support.id('room-flash'),'Past draft','draft',now()-interval '2 days',now()+interval '1 day');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,opens_at,closes_at)
values(test_support.id('calendar-past-publication'),test_support.id('calendar-past-draft'),test_support.id('cv-flash'),1,now()-interval '1 hour',now()-interval '30 minutes');
set local role service_role;
select public.run_calendar_tick('{"runId":"calendar-preserve-draft"}');
reset role;
select is((select status from public.scheduled_challenges where id=test_support.id('calendar-past-publication')),'scheduled','Tick never closes a draft planning window');
select lives_ok($$select public.preview_superadmin_calendar_change(pg_temp.calendar_input(test_support.id('calendar-past-draft'),1440))$$,'A draft remains reprogrammable after its provisional dates');
select * from finish();
rollback;
