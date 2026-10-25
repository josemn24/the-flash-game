-- Season measurement exists before an administrator opens it; membership and calendar are automatic.
insert into public.rooms(id,slug,title) values(test_support.id('room-empty'),'room-empty','Empty room');
insert into public.room_memberships(room_id,player_id,role) values(test_support.id('room-empty'),test_support.id('superadmin'),'owner');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('season-empty'),test_support.id('room-empty'),'Empty season','active',now()-interval '1 day',now()+interval '1 day');
insert into public.rooms(id,slug,title) values(test_support.id('room-upcoming'),'room-upcoming','Upcoming room');
insert into public.room_memberships(room_id,player_id,role) values(test_support.id('room-upcoming'),test_support.id('member'),'owner');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('season-upcoming'),test_support.id('room-upcoming'),'Upcoming season','scheduled',now()+interval '10 days',now()+interval '20 days');

select test_support.as_actor('superadmin');
do $$
declare overview jsonb; run_id uuid;
begin
 assert (select count(*)=1 from private.room_measurements where season_id=test_support.id('season-flash')),'Season creation starts measurement automatically';
 select id into run_id from private.room_measurements where season_id=test_support.id('season-flash');
 perform public.get_superadmin_season_measurement(test_support.id('room-flash'));
 perform public.get_superadmin_season_measurement(test_support.id('room-flash'));
 assert (select count(*)=1 from private.room_measurements where season_id=test_support.id('season-flash')), 'Repeated reads keep one automatic measurement';
 assert (select count(*)=3 from private.room_measurement_participants where measurement_id=run_id),'Initial scope includes active non-spectators only';
 assert (select count(*)=1 from private.room_measurement_publications where measurement_id=run_id),'Initial scope includes existing challenges';
 update public.room_memberships set role='member',joined_at=clock_timestamp(),updated_at=clock_timestamp()
   where room_id=test_support.id('room-flash') and player_id=test_support.id('spectator');
 insert into public.scheduled_challenges(season_id,challenge_version_id,number,status,opens_at,closes_at)
 values(test_support.id('season-flash'),test_support.id('cv-flash'),2,'scheduled',now()+interval '1 day',now()+interval '2 days');
 overview:=public.get_superadmin_season_measurement(test_support.id('room-flash'));
 assert jsonb_array_length(overview->'participants')=4,'A newly eligible member joins automatically';
 assert jsonb_array_length(overview->'publications')=2,'A newly scheduled challenge joins automatically';
 assert (select included_at>measurement.started_at from private.room_measurement_participants participant
   join private.room_measurements measurement on measurement.id=participant.measurement_id
   where measurement.id=run_id and participant.player_id=test_support.id('spectator')),'A later membership starts at its inclusion time';
 assert jsonb_array_length(overview->'attempts')=1,'Initial historical competitive attempts are reported';
 assert (select count(*)=1 from jsonb_array_elements(overview->'attempts') a where a->>'status'='completed'),'Historical initial completion is reported';
 assert (overview->>'startedAt')::timestamptz<clock_timestamp(),'Navigation capture has a start boundary';
 overview:=public.get_superadmin_season_measurement(test_support.id('room-upcoming'));
 assert overview->'season'->>'status'='scheduled','The next scheduled season is selected when there is no active season';
 assert jsonb_array_length(overview->'publications')=0,'A room with no challenges can begin tracking and include future additions';
end $$;

set local role authenticated;
select test_support.as_actor('member');
do $$
declare body jsonb;
begin
 body:=jsonb_build_object('eventId',test_support.id('room-event'),'visitId',test_support.id('room-visit'),
   'type','room_viewed','roomId','commands-flash','occurredAt',clock_timestamp(),'appVersion','room-contract');
 assert public.record_room_measurement_event(body),'Active room member event is recorded';
 assert public.record_room_measurement_event(body),'Event retry is idempotent';
 body:=body||jsonb_build_object('eventId',test_support.id('upcoming-room-event'),
   'visitId',test_support.id('upcoming-room-visit'),'roomId','room-upcoming');
 assert public.record_room_measurement_event(body),'A scheduled-season measurement captures room activity from its start';
end $$;

reset role;
select test_support.as_actor('superadmin');
do $$
declare overview jsonb;
begin
 overview:=public.get_superadmin_season_measurement(test_support.id('room-flash'));
 assert (select coalesce(sum((e->>'count')::integer),0)=1 from jsonb_array_elements(overview->'events') e where e->>'type'='room_viewed'),'Room visits are aggregated once per visit';
 overview:=public.get_superadmin_season_measurement(test_support.id('room-empty'),test_support.id('season-empty'));
 assert jsonb_array_length(overview->'participants')=0,'An empty season can be measured without manual setup';
 overview:=public.get_superadmin_season_measurement(test_support.id('room-flash'),test_support.id('season-flash'));
 assert jsonb_array_length(overview->'participants')=4,'Detailed report retains the dynamic scope';
 assert jsonb_array_length(overview->'publications')=2,'Detailed report contains the live calendar';
 assert jsonb_array_length(overview->'attempts')>=1,'Detailed report includes persisted competitive facts';
 assert public.get_superadmin_season_measurement(test_support.id('room-flash'),test_support.id('season-empty')) is null,'Cannot select a season from another room';
 overview:=public.get_superadmin_season_measurement(test_support.id('room-upcoming'));
 assert (select coalesce(sum((e->>'count')::integer),0)=1 from jsonb_array_elements(overview->'events') e where e->>'type'='room_viewed'),'Scheduled-season activity is attributed before the future season opens';
end $$;

set local role authenticated;
select test_support.as_actor('outsider');
do $$begin
 perform test_support.must_fail('select * from private.room_measurement_events','42501');
 perform test_support.must_fail('select * from private.room_measurement_ratings','42501');
 perform test_support.must_fail(format('select public.get_superadmin_season_measurement(%L,%L)',test_support.id('room-flash'),test_support.id('season-flash')),'42501');
end $$;
reset role;
do $$begin
 assert (select count(*)=2 from private.room_measurement_events),'Each event is persisted once despite retry';
end $$;
set local role authenticated;
select test_support.as_actor('member');
do $$declare rating jsonb; body jsonb; begin
 rating:=public.get_my_season_rating(test_support.id('sc-flash'));
 assert (rating->>'eligible')::boolean,'Enjoyment is available without experiment configuration';
 body:=jsonb_build_object('id',test_support.id('automatic-rating'),'publicationId',test_support.id('sc-flash'),'seasonId',test_support.id('season-flash'),'value',4);
 rating:=public.save_my_season_rating(body);
 assert (rating->>'value')::integer=4,'Automatic enjoyment is stored';
 perform public.save_my_season_rating(body);
 perform test_support.must_fail(format('select public.save_my_season_rating(%L::jsonb)',body||'{"value":3}'),'40001');
 body:=body||jsonb_build_object('id',test_support.id('automatic-rating-correction'),'value',5);
 rating:=public.save_my_season_rating(body);
 assert (rating->>'value')::integer=5,'Enjoyment can be corrected';
 perform test_support.must_fail(format('select public.save_my_season_rating(%L::jsonb)',body||'{"value":6}'),'22023');
end $$;
reset role;
select test_support.as_actor('superadmin');
do $$declare report jsonb; begin
 assert (select count(*)=2 from private.room_measurement_ratings),'Retry does not duplicate a rating';
 report:=public.get_superadmin_season_measurement(test_support.id('room-flash'),test_support.id('season-flash'));
 assert (select count(*)=1 from jsonb_array_elements(report->'ratings') r where r->>'playerId'=test_support.id('member')::text and r->>'publicationId'=test_support.id('sc-flash')::text and (r->>'value')::integer=5),'Report includes only the latest enjoyment per person and challenge';
end $$;
-- Room-level navigation has one preferred season; publication observations keep their season.
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('season-flash-future'),test_support.id('room-flash'),'Later season','scheduled',now()+interval '4 days',now()+interval '5 days');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('future-publication'),test_support.id('season-flash-future'),test_support.id('cv-flash'),1,'scheduled',now()+interval '4 days',now()+interval '5 days');
set local role authenticated;
select test_support.as_actor('member');
do $$declare body jsonb; begin
 body:=jsonb_build_object('eventId',test_support.id('preferred-season-event'),'visitId',test_support.id('preferred-season-visit'),'roomId','commands-flash','type','ranking_viewed','occurredAt',clock_timestamp(),'appVersion','season-contract');
 assert public.record_room_measurement_event(body),'Generic observation is captured';
 body:=body||jsonb_build_object('eventId',test_support.id('publication-season-event'),'visitId',test_support.id('publication-season-visit'),'type','challenge_intro_viewed','publicationId',test_support.id('future-publication'));
 assert public.record_room_measurement_event(body),'Publication observation is captured in its own season';
end $$;
reset role;
do $$begin
 assert (select count(*)=1 from private.room_measurement_events where event_id=test_support.id('preferred-season-event')),'Generic observation is not duplicated across future seasons';
 assert exists(select 1 from private.room_measurement_events e join private.room_measurements m on m.id=e.measurement_id where e.event_id=test_support.id('preferred-season-event') and m.season_id=test_support.id('season-flash')),'Generic event belongs to the active season';
 assert exists(select 1 from private.room_measurement_events e join private.room_measurements m on m.id=e.measurement_id where e.event_id=test_support.id('publication-season-event') and m.season_id=test_support.id('season-flash-future')),'Publication event retains its season';
end $$;

-- Capture has its own quota; duplicates and other seasons do not consume it.
set local role authenticated;
select test_support.as_actor('member');
do $$declare body jsonb; begin
 for n in 1..60 loop
  body:=jsonb_build_object('eventId',test_support.id('quota-event-'||n),'visitId',test_support.id('quota-visit-'||n),'roomId','commands-flash','type','room_viewed','occurredAt',clock_timestamp(),'appVersion','quota');
  perform public.record_room_measurement_event(body);
 end loop;
 assert not public.record_room_measurement_event(body),'New observations stop when the independent quota is saturated';
 body:=body||jsonb_build_object('eventId',test_support.id('preferred-season-event'),'visitId',test_support.id('preferred-season-visit'),'type','ranking_viewed');
 assert public.record_room_measurement_event(body),'A retry still succeeds after saturation';
 body:=body||jsonb_build_object('eventId',test_support.id('independent-season-event'),'visitId',test_support.id('independent-season-visit'),'roomId','room-upcoming');
 assert public.record_room_measurement_event(body),'Another season retains its quota';
end $$;
reset role;

-- The optional response remains visible but cannot be changed after seven days.
-- Disposable fixture only: place the already-played season in the past to exercise the real clock.
alter table public.seasons disable trigger seasons_guard;
update public.seasons set starts_at=now()-interval '12 days',ends_at=now()-interval '8 days',status='finished'
where id=test_support.id('season-flash');
alter table public.seasons enable trigger seasons_guard;
set local role authenticated;
select test_support.as_actor('member');
do $$declare rating jsonb; begin
 rating:=public.get_my_season_rating(test_support.id('sc-flash'));
 assert not (rating->>'eligible')::boolean and (rating->>'value')::integer=5,'Closed enjoyment retains the saved value';
 perform test_support.must_fail(format('select public.save_my_season_rating(%L::jsonb)',jsonb_build_object('id',test_support.id('closed-rating'),'publicationId',test_support.id('sc-flash'),'seasonId',test_support.id('season-flash'),'value',3)),'22023');
 assert not public.record_room_measurement_event(jsonb_build_object('eventId',test_support.id('closed-event'),'visitId',test_support.id('closed-visit'),'roomId','commands-flash','publicationId',test_support.id('sc-flash'),'type','review_viewed','occurredAt',clock_timestamp(),'appVersion','closed')),'Finished seasons reject new observations';
end $$;
reset role;
select 'room_measurement_contract_ok';
