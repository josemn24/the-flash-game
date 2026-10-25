-- A room-first, season-scoped observation. Unlike product experiments, its scope grows with the room.
create table private.room_measurements (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id),
 season_id uuid not null references public.seasons(id),
 status text not null default 'running' check(status in ('running','closed')),
 started_at timestamptz not null default clock_timestamp(),
 closed_at timestamptz,
 created_by_player_id uuid not null references public.players(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(room_id,season_id),
 check((status='closed')=(closed_at is not null))
);
create table private.room_measurement_participants (
 measurement_id uuid not null references private.room_measurements(id),
 player_id uuid not null references public.players(id),
 included_at timestamptz not null,
 history_from timestamptz not null,
 primary key(measurement_id,player_id)
);
create table private.room_measurement_publications (
 measurement_id uuid not null references private.room_measurements(id),
 publication_id uuid not null references public.scheduled_challenges(id),
 included_at timestamptz not null,
 history_from timestamptz not null,
 primary key(measurement_id,publication_id)
);
create table private.room_measurement_events (
 measurement_id uuid not null,
 event_id uuid not null,
 player_id uuid not null,
 publication_id uuid,
 type text not null check(type in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed')),
 visit_id uuid not null,
 occurred_at timestamptz not null,
 received_at timestamptz not null default clock_timestamp(),
 app_version text not null check(length(app_version) between 1 and 80),
 primary key(measurement_id,event_id),
 foreign key(measurement_id,player_id) references private.room_measurement_participants(measurement_id,player_id),
 foreign key(measurement_id,publication_id) references private.room_measurement_publications(measurement_id,publication_id)
);
create index room_measurement_participant_player_idx on private.room_measurement_participants(player_id,measurement_id);
create index room_measurement_publication_lookup_idx on private.room_measurement_publications(publication_id,measurement_id);
create index room_measurement_events_summary_idx on private.room_measurement_events(measurement_id,type,occurred_at);
alter table private.room_measurements enable row level security;
alter table private.room_measurement_participants enable row level security;
alter table private.room_measurement_publications enable row level security;
alter table private.room_measurement_events enable row level security;
revoke all on private.room_measurements,private.room_measurement_participants,private.room_measurement_publications,private.room_measurement_events from public,anon,authenticated,service_role;

create function private.sync_room_measurement(target_measurement_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare measurement private.room_measurements%rowtype; season public.seasons%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(target_measurement_id::text,0));
 select * into measurement from private.room_measurements where id=target_measurement_id for update;
 if not found then return; end if;
 select * into season from public.seasons where id=measurement.season_id;
 if not found then return; end if;
 if season.status in ('finished','cancelled') and measurement.status='running' then
   update private.room_measurements set status='closed',closed_at=clock_timestamp() where id=measurement.id;
   return;
 end if;
 if measurement.status<>'running' then return; end if;
 insert into private.room_measurement_participants(measurement_id,player_id,included_at,history_from)
 select measurement.id,membership.player_id,
   greatest(measurement.started_at,membership.joined_at,membership.updated_at),
   greatest(measurement.started_at,membership.joined_at,membership.updated_at)
 from public.room_memberships membership join public.players player on player.id=membership.player_id
 where membership.room_id=measurement.room_id and membership.status='active'
   and membership.role in ('owner','admin','member') and player.status='active'
   and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id)
 on conflict(measurement_id,player_id) do nothing;
 insert into private.room_measurement_publications(measurement_id,publication_id,included_at,history_from)
 select measurement.id,challenge.id,greatest(measurement.started_at,challenge.created_at),
   greatest(measurement.started_at,challenge.created_at)
 from public.scheduled_challenges challenge
 where challenge.season_id=measurement.season_id and challenge.status<>'cancelled'
 on conflict(measurement_id,publication_id) do nothing;
end $$;
alter function private.sync_room_measurement(uuid) owner to postgres;
revoke all on function private.sync_room_measurement(uuid) from public,anon,authenticated,service_role;

create function public.start_superadmin_room_measurement(target_room_id uuid,target_season_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.require_measurement_admin(); season public.seasons%rowtype; measurement private.room_measurements%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('room-measurement:'||target_season_id::text,0));
 select season_row.* into season from public.seasons season_row join public.rooms room on room.id=season_row.room_id
 where season_row.id=target_season_id and season_row.room_id=target_room_id and room.status='active'
   and season_row.status in ('active','scheduled') for update of season_row;
 if not found then raise exception 'measurement_season_unavailable' using errcode='22023'; end if;
 select * into measurement from private.room_measurements where room_id=target_room_id and season_id=target_season_id for update;
 if not found then
   if not exists(
     select 1 from public.room_memberships membership join public.players player on player.id=membership.player_id
     where membership.room_id=target_room_id and membership.status='active'
       and membership.role in ('owner','admin','member') and player.status='active'
       and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id)
   ) then raise exception 'no_eligible_participants' using errcode='22023'; end if;
   insert into private.room_measurements(room_id,season_id,started_at,created_by_player_id)
   values(target_room_id,target_season_id,clock_timestamp(),actor) returning * into measurement;
   insert into private.room_measurement_participants(measurement_id,player_id,included_at,history_from)
   select measurement.id,membership.player_id,
     greatest(measurement.started_at,membership.joined_at),greatest(season.starts_at,membership.joined_at)
   from public.room_memberships membership join public.players player on player.id=membership.player_id
   where membership.room_id=target_room_id and membership.status='active'
     and membership.role in ('owner','admin','member') and player.status='active'
     and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id)
   on conflict(measurement_id,player_id) do nothing;
   insert into private.room_measurement_publications(measurement_id,publication_id,included_at,history_from)
   select measurement.id,challenge.id,measurement.started_at,season.starts_at from public.scheduled_challenges challenge
   where challenge.season_id=target_season_id and challenge.status<>'cancelled'
   on conflict(measurement_id,publication_id) do nothing;
 else
   if measurement.status='closed' then raise exception 'measurement_closed' using errcode='22023'; end if;
 end if;
 perform private.sync_room_measurement(measurement.id);
 return jsonb_build_object('measurementId',measurement.id,'seasonId',target_season_id);
end $$;
alter function public.start_superadmin_room_measurement(uuid,uuid) owner to postgres;
revoke all on function public.start_superadmin_room_measurement(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.start_superadmin_room_measurement(uuid,uuid) to authenticated;

create function public.get_superadmin_room_measurement(target_room_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.require_measurement_admin(); room public.rooms%rowtype; season public.seasons%rowtype;
 measurement private.room_measurements%rowtype; eligible_count integer:=0; challenge_count integer:=0;
 room_visits integer:=0; challenge_opens integer:=0; starts integer:=0; completions integer:=0; returning_people_count integer:=0;
 rankings integer:=0; reviews integer:=0; practice_starts integer:=0; practice_completions integer:=0;
 rehearsal_starts integer:=0; rehearsal_completions integer:=0; test_starts integer:=0; test_completions integer:=0;
begin
 select * into room from public.rooms where id=target_room_id and status='active';
 if not found then return null; end if;
 select * into season from public.seasons s where s.room_id=target_room_id and s.status='active'
 order by s.starts_at desc,s.id limit 1;
 if not found then
   select * into season from public.seasons s where s.room_id=target_room_id and s.status='scheduled'
   order by s.starts_at,s.id limit 1;
 end if;
 if not found then
   select s.* into season from private.room_measurements m join public.seasons s on s.id=m.season_id
   where m.room_id=target_room_id order by m.started_at desc limit 1;
 end if;
 if not found then
   select count(*) into eligible_count from public.room_memberships membership join public.players player on player.id=membership.player_id
   where membership.room_id=target_room_id and membership.status='active'
     and membership.role in ('owner','admin','member') and player.status='active'
     and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id);
   return jsonb_build_object('roomId',room.id,'roomTitle',room.title,'season',null,
     'eligiblePeople',eligible_count,'scheduledChallenges',0,'measurement',null);
 end if;
 select * into measurement from private.room_measurements m where m.room_id=target_room_id and m.season_id=season.id;
 if found then
   perform private.sync_room_measurement(measurement.id);
   select * into measurement from private.room_measurements m where m.id=measurement.id;
 end if;
 select count(*) into eligible_count from public.room_memberships membership join public.players player on player.id=membership.player_id
 where membership.room_id=target_room_id and membership.status='active'
   and membership.role in ('owner','admin','member') and player.status='active'
   and not exists(select 1 from private.platform_role_assignments op where op.player_id=player.id);
 select count(*) into challenge_count from public.scheduled_challenges challenge
 where challenge.season_id=season.id and challenge.status<>'cancelled';
 if measurement.id is not null then
   select count(*) into eligible_count from private.room_measurement_participants where measurement_id=measurement.id;
   select count(*) into challenge_count from private.room_measurement_publications scope
   join public.scheduled_challenges challenge on challenge.id=scope.publication_id
   where scope.measurement_id=measurement.id and challenge.status<>'cancelled';
   select count(distinct visit_id) filter(where type='room_viewed'),
     count(*) filter(where type='challenge_intro_viewed'),
     count(*) filter(where type='ranking_viewed'),
     count(*) filter(where type='review_viewed'),
     count(*) filter(where type='rehearsal_started'),
     count(*) filter(where type='rehearsal_completed')
   into room_visits,challenge_opens,rankings,reviews,rehearsal_starts,rehearsal_completions
   from private.room_measurement_events where measurement_id=measurement.id;
   with scoped_attempts as (
     select attempt.* from public.attempts attempt
     join private.room_measurement_participants participant on participant.measurement_id=measurement.id and participant.player_id=attempt.player_id
     join private.room_measurement_publications publication on publication.measurement_id=measurement.id and publication.publication_id=attempt.scheduled_challenge_id
     where attempt.started_at>=greatest(participant.history_from,publication.history_from)
   )
   select count(*) filter(where attempt.kind='competitive' and attempt.status<>'invalidated'),
     count(*) filter(where attempt.kind='competitive' and attempt.status='completed'),
     (select count(*) from (select returning_attempt.player_id from scoped_attempts returning_attempt
       where returning_attempt.kind='competitive' and returning_attempt.status<>'invalidated'
       group by returning_attempt.player_id having count(distinct returning_attempt.scheduled_challenge_id)>1) returning_people),
     count(*) filter(where attempt.kind='test' and attempt.status<>'invalidated'),
     count(*) filter(where attempt.kind='test' and attempt.status='completed')
   into starts,completions,returning_people_count,test_starts,test_completions from scoped_attempts attempt;
   practice_starts:=rehearsal_starts+test_starts;
   practice_completions:=rehearsal_completions+test_completions;
 end if;
 return jsonb_build_object(
   'roomId',room.id,'roomTitle',room.title,
   'season',jsonb_build_object('seasonId',season.id,'title',season.title,'status',season.status,'startsAt',season.starts_at,'endsAt',season.ends_at),
   'eligiblePeople',eligible_count,'scheduledChallenges',challenge_count,
   'measurement',case when measurement.id is null then null else jsonb_build_object(
     'id',measurement.id,'startedAt',measurement.started_at,'status',measurement.status,
     'participantCount',eligible_count,'challengeCount',challenge_count,
     'eventCaptureFrom',measurement.started_at,'generatedAt',clock_timestamp(),
     'metrics',jsonb_build_object('roomVisits',room_visits,'challengeOpens',challenge_opens,
       'competitiveStarts',starts,'competitiveCompletions',completions,'returningPeople',returning_people_count,
       'rankingViews',rankings,'reviewViews',reviews,'practiceStarts',practice_starts,'practiceCompletions',practice_completions)
   ) end
 );
end $$;
alter function public.get_superadmin_room_measurement(uuid) owner to postgres;
revoke all on function public.get_superadmin_room_measurement(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_room_measurement(uuid) to authenticated;

create function public.record_room_measurement_event(input jsonb) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); room public.rooms%rowtype; measurement private.room_measurements%rowtype;
 participant private.room_measurement_participants%rowtype; previous private.room_measurement_events%rowtype;
 pid uuid:=nullif(input->>'publicationId','')::uuid; event_at timestamptz:=(input->>'occurredAt')::timestamptz;
 visit uuid:=(input->>'visitId')::uuid; event_id_value uuid:=(input->>'eventId')::uuid;
 instant timestamptz:=clock_timestamp(); recorded boolean:=false;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(array['eventId','type','roomId','publicationId','visitId','occurredAt','appVersion']))
   or input->>'eventId' is null or input->>'visitId' is null or input->>'roomId' is null or input->>'occurredAt' is null
   or input->>'appVersion' is null
   or input->>'type' not in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed') then
   raise exception 'invalid_event' using errcode='22023';
 end if;
 if pid is null and input->>'type' not in ('room_viewed','ranking_viewed') then raise exception 'invalid_context' using errcode='22023'; end if;
 if event_at>instant or length(coalesce(input->>'appVersion','')) not between 1 and 80 then raise exception 'invalid_event' using errcode='22023'; end if;
 select * into room from public.rooms where slug=input->>'roomId' and status='active';
 if not found then return false; end if;
 for measurement in select m.* from private.room_measurements m join public.seasons s on s.id=m.season_id
   where m.room_id=room.id and m.status='running' and s.status in ('active','scheduled') and instant<=s.ends_at
   order by m.id loop
   perform private.sync_room_measurement(measurement.id);
   if not exists(select 1 from public.room_memberships membership join public.players player on player.id=membership.player_id
     where membership.room_id=room.id and membership.player_id=actor and membership.status='active'
       and membership.role in ('owner','admin','member') and player.status='active'
       and not exists(select 1 from private.platform_role_assignments op where op.player_id=actor)) then continue; end if;
   select * into participant from private.room_measurement_participants p
     where p.measurement_id=measurement.id and p.player_id=actor;
   if not found or event_at<greatest(measurement.started_at,participant.included_at) then continue; end if;
   if pid is not null and not exists(select 1 from private.room_measurement_publications scope
     join public.scheduled_challenges challenge on challenge.id=scope.publication_id
     where scope.measurement_id=measurement.id and scope.publication_id=pid
       and scope.included_at<=event_at and challenge.status<>'cancelled') then continue; end if;
   perform pg_advisory_xact_lock(hashtextextended('room-measurement-event:'||measurement.id||':'||actor,0));
   select * into previous from private.room_measurement_events where measurement_id=measurement.id and event_id=event_id_value;
   if found then
     if previous.player_id<>actor or previous.type<>input->>'type' or previous.visit_id<>visit or previous.publication_id is distinct from pid then
       raise exception 'idempotency_conflict' using errcode='40001';
     end if;
     recorded:=true; continue;
   end if;
   if (select count(*) from private.room_measurement_events event_row where event_row.measurement_id=measurement.id
     and event_row.player_id=actor and event_row.received_at>instant-interval '1 minute')>=60 then continue; end if;
   insert into private.room_measurement_events(measurement_id,event_id,player_id,publication_id,type,visit_id,occurred_at,app_version)
   values(measurement.id,event_id_value,actor,pid,input->>'type',visit,event_at,input->>'appVersion') on conflict do nothing;
   recorded:=true;
 end loop;
 return recorded;
end $$;
alter function public.record_room_measurement_event(jsonb) owner to postgres;
revoke all on function public.record_room_measurement_event(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_room_measurement_event(jsonb) to authenticated;
