-- Independent disposable transaction: do not change the original season contract's counts.
create function test_support.observation(label text, signal text, run text) returns jsonb
language sql volatile as $$
 select jsonb_build_object('eventId',test_support.id(label),'visitId',test_support.id(run),
   'roomId','commands-flash','publicationId',test_support.id('sc-flash'),'type',signal,
   'occurredAt',clock_timestamp(),'appVersion','measurement-reliability')
$$;
grant execute on function test_support.observation(text,text,text) to authenticated;

set local role authenticated;
select test_support.as_actor('member');
do $$declare body jsonb; shift interval; n integer:=0; begin
 foreach shift in array array[interval '30 seconds',interval '24 hours',interval '-24 hours'] loop
   n:=n+1;
   body:=test_support.observation('clock-'||n,'challenge_intro_viewed','clock-'||n)
     ||jsonb_build_object('occurredAt',clock_timestamp()+shift);
   assert public.record_room_measurement_event(body),'A finite client clock skew does not discard an eligible observation';
 end loop;
 foreach shift in array array[interval '30 seconds',interval '-24 hours'] loop
   body:=test_support.observation('generic-clock-'||shift,'room_viewed','generic-clock-'||shift)-'publicationId'
     ||jsonb_build_object('occurredAt',clock_timestamp()+shift);
   assert public.record_room_measurement_event(body),'Generic observations also use the server attribution clock';
 end loop;
 foreach body in array array[
   test_support.observation('infinite-clock','room_viewed','invalid')||'{"occurredAt":"infinity"}'::jsonb,
   test_support.observation('negative-infinite-clock','room_viewed','invalid')||'{"occurredAt":"-infinity"}'::jsonb
 ] loop
   perform test_support.must_fail(format('select public.record_room_measurement_event(%L::jsonb)',body),'22023');
 end loop;
 perform test_support.must_fail(format('select public.record_room_measurement_event(%L::jsonb)',
   test_support.observation('invalid-clock','room_viewed','invalid')||'{"occurredAt":"invalid"}'::jsonb),'22007');
end $$;
reset role;
do $$begin
 assert exists(select 1 from private.room_measurement_events where event_id=test_support.id('clock-2')
   and occurred_at>received_at+interval '23 hours'),'The original future timestamp is retained as diagnostic data';
 assert exists(select 1 from private.room_measurement_events where event_id=test_support.id('clock-3')
   and occurred_at<received_at-interval '23 hours'),'The original past timestamp is retained';
end $$;

insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('reliability-publication'),test_support.id('season-flash'),test_support.id('cv-flash'),2,
 'scheduled',now()+interval '1 day',now()+interval '2 days');
set local role authenticated;
select test_support.as_actor('member');
do $$declare body jsonb; begin
 body:=test_support.observation('run-start','rehearsal_started','same-run');
 assert public.record_room_measurement_event(body);
 assert public.record_room_measurement_event(body),'Exact HTTP replay succeeds';
 assert public.record_room_measurement_event(body||jsonb_build_object('eventId',test_support.id('remounted-start'))),
   'A fresh event ID for an existing execution succeeds without duplication';
 perform test_support.must_fail(format('select public.record_room_measurement_event(%L::jsonb)',body||'{"type":"rehearsal_completed"}'::jsonb),'40001');
 assert public.record_room_measurement_event(test_support.observation('run-complete','rehearsal_completed','same-run'));
 assert public.record_room_measurement_event(test_support.observation('remounted-complete','rehearsal_completed','same-run'));
 assert public.record_room_measurement_event(test_support.observation('other-run','rehearsal_completed','other-run'));
 assert public.record_room_measurement_event(test_support.observation('other-publication','rehearsal_completed','same-run')
   ||jsonb_build_object('publicationId',test_support.id('reliability-publication')));
 assert public.record_room_measurement_event(test_support.observation('other-season','rehearsal_completed','same-run')
   ||jsonb_build_object('roomId','commands-alphabet','publicationId',test_support.id('sc-alphabet')));
end $$;
select test_support.as_actor('member2');
select public.record_room_measurement_event(test_support.observation('other-person','rehearsal_completed','same-run'));
reset role;
do $$begin
 assert (select count(*)=1 from private.room_measurement_events where player_id=test_support.id('member')
   and publication_id=test_support.id('sc-flash') and visit_id=test_support.id('same-run') and type='rehearsal_started');
 assert (select count(*)=1 from private.room_measurement_events where player_id=test_support.id('member')
   and publication_id=test_support.id('sc-flash') and visit_id=test_support.id('same-run') and type='rehearsal_completed');
 assert (select count(*)=4 from private.room_measurement_events where visit_id=test_support.id('same-run')
   and type='rehearsal_completed'),'Person, publication and season remain independent';
end $$;

-- The database also prevents duplicates if a writer bypasses RPC deduplication.
do $$declare label text; begin
 foreach label in array array['run-start','run-complete'] loop
   perform test_support.must_fail(format(
     'insert into private.room_measurement_events(measurement_id,event_id,player_id,publication_id,type,visit_id,occurred_at,app_version)
      select measurement_id,%L::uuid,player_id,publication_id,type,visit_id,occurred_at,app_version
      from private.room_measurement_events where event_id=%L::uuid',
     test_support.id('duplicate-row-'||label),test_support.id(label)), '23505');
 end loop;
end $$;

-- Navigation outside the partial index can still contain several events for one visit.
set local role authenticated;
select test_support.as_actor('member');
select public.record_room_measurement_event(test_support.observation('navigation-one','challenge_intro_viewed','navigation-visit'));
select public.record_room_measurement_event(test_support.observation('navigation-two','challenge_intro_viewed','navigation-visit'));
reset role;
select test_support.as_actor('superadmin');
do $$declare report jsonb; begin
 report:=public.get_superadmin_season_measurement(test_support.id('room-flash'));
 assert (select (e->>'count')::int=1 from jsonb_array_elements(report->'events') e
   where e->>'playerId'=test_support.id('member')::text and e->>'publicationId'=test_support.id('sc-flash')::text
     and e->>'type'='rehearsal_started'),'The report counts the single stored start';
 assert (select (e->>'count')::int=2 from jsonb_array_elements(report->'events') e
   where e->>'playerId'=test_support.id('member')::text and e->>'publicationId'=test_support.id('sc-flash')::text
     and e->>'type'='rehearsal_completed'),'Distinct executions remain distinct';
 assert (select (e->>'count')::int=5 from jsonb_array_elements(report->'events') e
   where e->>'playerId'=test_support.id('member')::text and e->>'publicationId'=test_support.id('sc-flash')::text
     and e->>'type'='challenge_intro_viewed'),'Other navigation signals still count distinct event IDs';
 assert jsonb_array_length(report->'attempts')=1 and report->'attempts'->0->>'status'='completed',
   'Competitive facts are unchanged';
end $$;

set local role authenticated;
select test_support.as_actor('member');
do $$declare body jsonb; begin
 for n in 1..65 loop
   body:=test_support.observation('fill-quota-'||n,'room_viewed','fill-quota-'||n);
   perform public.record_room_measurement_event(body);
 end loop;
 assert not public.record_room_measurement_event(test_support.observation('over-quota','rehearsal_completed','new-run'));
 assert public.record_room_measurement_event(test_support.observation('duplicate-after-quota','rehearsal_completed','same-run')),
   'A semantic duplicate still succeeds after quota saturation';
end $$;
reset role;
do $$begin
 assert (select count(*)=60 from private.room_measurement_events ev join private.room_measurements m on m.id=ev.measurement_id
   where m.season_id=test_support.id('season-flash') and ev.player_id=test_support.id('member'));
 assert not exists(select 1 from private.room_measurement_events where event_id=test_support.id('duplicate-after-quota'));
end $$;

-- Expiry is enforced even if the calendar has not yet changed the season status.
set constraints all immediate;
alter table public.seasons disable trigger seasons_guard;
alter table public.seasons disable trigger season_calendar_containment;
update public.seasons set starts_at=now()-interval '4 days',ends_at=now()-interval '2 days'
where id=test_support.id('season-flash');
alter table public.seasons enable trigger season_calendar_containment;
alter table public.seasons enable trigger seasons_guard;
set local role authenticated;
select test_support.as_actor('member');
do $$begin
 assert not public.record_room_measurement_event(test_support.observation('expired-server-window','review_viewed','closed')
   ||jsonb_build_object('occurredAt',clock_timestamp()-interval '3 days')),
   'A past client timestamp cannot admit a new observation after server expiry';
end $$;
reset role;
set constraints all immediate;
alter table public.seasons disable trigger seasons_guard;
alter table public.seasons disable trigger season_calendar_containment;
update public.seasons set status='finished' where id=test_support.id('season-flash');
alter table public.seasons enable trigger season_calendar_containment;
alter table public.seasons enable trigger seasons_guard;
set local role authenticated;
do $$begin
 assert not public.record_room_measurement_event(test_support.observation('finished-window','review_viewed','closed')
   ||jsonb_build_object('occurredAt',clock_timestamp()-interval '3 days'));
end $$;
reset role;
select 'measurement_reliability_contract_ok';
