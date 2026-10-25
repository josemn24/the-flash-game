-- Accept diagnostic client clock skew and count each rehearsal signal once per execution.
create unique index room_measurement_events_rehearsal_run_idx
 on private.room_measurement_events(measurement_id,player_id,publication_id,type,visit_id)
 where type in ('rehearsal_started','rehearsal_completed');

create or replace function public.get_superadmin_season_measurement(target_room_id uuid,target_season_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.require_measurement_admin(); room public.rooms%rowtype; season public.seasons%rowtype;
 measurement private.room_measurements%rowtype; instant timestamptz:=clock_timestamp();
begin
 select * into room from public.rooms where id=target_room_id;
 if not found then return null; end if;
 select * into season from public.seasons s where s.room_id=room.id
   and (target_season_id is null or s.id=target_season_id)
 order by case s.status when 'active' then 0 when 'scheduled' then 1 when 'draft' then 2 else 3 end,
   case when s.status='scheduled' then s.starts_at end,s.starts_at desc,s.id limit 1;
 if target_season_id is not null and not found then return null; end if;
 if season.id is not null then
   perform private.ensure_season_measurement(season.id);
   select * into measurement from private.room_measurements where season_id=season.id and room_id=room.id;
 end if;
 return jsonb_build_object('roomId',room.id,'roomTitle',room.title,'generatedAt',instant,'startedAt',measurement.started_at,
   'season',case when season.id is null then null else jsonb_build_object('seasonId',season.id,'title',season.title,'status',season.status,'startsAt',season.starts_at,'endsAt',season.ends_at) end,
   'seasons',coalesce((select jsonb_agg(jsonb_build_object('seasonId',s.id,'title',s.title,'status',s.status,'startsAt',s.starts_at,'endsAt',s.ends_at) order by s.starts_at desc,s.id) from public.seasons s where s.room_id=room.id),'[]'::jsonb),
   'participants',coalesce((select jsonb_agg(jsonb_build_object('playerId',p.player_id,'displayName',player.display_name,'historyFrom',p.history_from) order by player.display_name,p.player_id)
     from private.room_measurement_participants p join public.players player on player.id=p.player_id where p.measurement_id=measurement.id and not exists(select 1 from private.platform_role_assignments op where op.player_id=p.player_id)),'[]'::jsonb),
   'publications',coalesce((select jsonb_agg(jsonb_build_object('publicationId',p.publication_id,'number',sc.number,'title',cv.title,'opensAt',sc.opens_at,'closesAt',sc.closes_at,'historyFrom',p.history_from,'status',sc.status) order by sc.number,sc.id)
     from private.room_measurement_publications p join public.scheduled_challenges sc on sc.id=p.publication_id join private.challenge_versions cv on cv.id=sc.challenge_version_id
     where p.measurement_id=measurement.id and sc.status<>'cancelled'),'[]'::jsonb),
   'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'publicationId',a.scheduled_challenge_id,'kind',a.kind,'status',a.status,'score',a.score,'startedAt',a.started_at,'completedAt',a.completed_at) order by a.started_at,a.id)
     from public.attempts a join private.room_measurement_participants person on person.measurement_id=measurement.id and person.player_id=a.player_id
     join private.room_measurement_publications pub on pub.measurement_id=measurement.id and pub.publication_id=a.scheduled_challenge_id
     join public.scheduled_challenges sc on sc.id=pub.publication_id
     where not exists(select 1 from private.platform_role_assignments op where op.player_id=a.player_id) and sc.status<>'cancelled' and a.kind in ('competitive','test') and a.started_at>=greatest(person.history_from,pub.history_from) and a.started_at<=instant),'[]'::jsonb),
   -- Aggregate in PostgreSQL; navigation volume does not inflate the report payload.
   'events',coalesce((select jsonb_agg(jsonb_build_object('playerId',e.player_id,'publicationId',e.publication_id,'type',e.type,'count',e.total))
     from (select ev.player_id,ev.publication_id,ev.type,case when ev.type='room_viewed' then count(distinct ev.visit_id) else count(*) end as total
       from private.room_measurement_events ev left join public.scheduled_challenges sc on sc.id=ev.publication_id
       where ev.measurement_id=measurement.id and not exists(select 1 from private.platform_role_assignments op where op.player_id=ev.player_id) and ev.received_at<=instant and (ev.publication_id is null or sc.status<>'cancelled') group by ev.player_id,ev.publication_id,ev.type) e),'[]'::jsonb),
   'ratings',coalesce((select jsonb_agg(jsonb_build_object('playerId',r.player_id,'publicationId',r.publication_id,'value',r.value)) from (
     select distinct on (v.player_id,v.publication_id) v.*
     from private.room_measurement_ratings v
     join private.room_measurement_publications pub on pub.measurement_id=measurement.id and pub.publication_id=v.publication_id
     join public.scheduled_challenges sc on sc.id=pub.publication_id and sc.status<>'cancelled'
     where v.measurement_id=measurement.id and v.received_at<=instant
       and not exists(select 1 from private.platform_role_assignments op where op.player_id=v.player_id)
     order by v.player_id,v.publication_id,v.received_at desc,v.id desc
   ) r),'[]'::jsonb)
 );
end $$;
alter function public.get_superadmin_season_measurement(uuid,uuid) owner to postgres;
revoke all on function public.get_superadmin_season_measurement(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_superadmin_season_measurement(uuid,uuid) to authenticated;

create or replace function public.record_room_measurement_event(input jsonb) returns boolean
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
 -- Client time is diagnostic; admission and attribution use the server reception clock.
 if not isfinite(event_at) or length(coalesce(input->>'appVersion','')) not between 1 and 80 then raise exception 'invalid_event' using errcode='22023'; end if;
 select * into room from public.rooms where slug=input->>'roomId' and status='active';
 if not found then return false; end if;
 for measurement in select m.* from private.room_measurements m join public.seasons s on s.id=m.season_id
   where m.room_id=room.id and m.status='running' and s.status in ('active','scheduled') and instant<=s.ends_at
     and (pid is not null or s.id=(select preferred.id from public.seasons preferred
       where preferred.room_id=room.id and preferred.status in ('active','scheduled')
       order by case preferred.status when 'active' then 0 else 1 end,
         case when preferred.status='scheduled' then preferred.starts_at end,preferred.starts_at desc,preferred.id limit 1))
   order by m.id loop
   perform private.sync_room_measurement(measurement.id);
   if not exists(select 1 from public.room_memberships membership join public.players player on player.id=membership.player_id
     where membership.room_id=room.id and membership.player_id=actor and membership.status='active'
       and membership.role in ('owner','admin','member') and player.status='active'
       and not exists(select 1 from private.platform_role_assignments op where op.player_id=actor)) then continue; end if;
   select * into participant from private.room_measurement_participants p
     where p.measurement_id=measurement.id and p.player_id=actor;
   if not found or instant<greatest(measurement.started_at,participant.included_at) then continue; end if;
   if pid is not null and not exists(select 1 from private.room_measurement_publications scope
     join public.scheduled_challenges challenge on challenge.id=scope.publication_id
     where scope.measurement_id=measurement.id and scope.publication_id=pid
       and scope.included_at<=instant and challenge.status<>'cancelled') then continue; end if;
   perform pg_advisory_xact_lock(hashtextextended('room-measurement-event:'||measurement.id||':'||actor,0));
   select * into previous from private.room_measurement_events where measurement_id=measurement.id and event_id=event_id_value;
   if found then
     if previous.player_id<>actor or previous.type<>input->>'type' or previous.visit_id<>visit or previous.publication_id is distinct from pid then
       raise exception 'idempotency_conflict' using errcode='40001';
     end if;
     recorded:=true; continue;
   end if;
   -- Deduplicate execution signals inside the actor lock and before checking quota.
   if input->>'type' in ('rehearsal_started','rehearsal_completed') and exists(
     select 1 from private.room_measurement_events event_row where event_row.measurement_id=measurement.id
       and event_row.player_id=actor and event_row.publication_id=pid
       and event_row.type=input->>'type' and event_row.visit_id=visit
   ) then recorded:=true; continue; end if;
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
