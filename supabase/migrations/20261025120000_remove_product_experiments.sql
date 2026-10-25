-- Remove the pre-production experiment system. Official facts and automatic season data remain.
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

create or replace function public.get_my_season_rating(target_publication_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); measurement private.room_measurements%rowtype; rating integer; finish timestamptz;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 select m.* into measurement from private.room_measurements m join private.room_measurement_publications p on p.measurement_id=m.id
 join private.room_measurement_participants person on person.measurement_id=m.id and person.player_id=actor
 join public.room_memberships membership on membership.room_id=m.room_id and membership.player_id=actor and membership.status='active' and membership.role<>'spectator'
 join public.players player on player.id=actor and player.status='active'
 join public.rooms room on room.id=m.room_id and room.status='active'
 join public.scheduled_challenges sc on sc.id=p.publication_id and sc.status<>'cancelled'
 where p.publication_id=target_publication_id and not exists(select 1 from private.platform_role_assignments op where op.player_id=actor)
 and exists(select 1 from public.attempts a where a.player_id=actor and a.scheduled_challenge_id=p.publication_id and a.kind='competitive' and a.status='completed');
 if not found then return jsonb_build_object('eligible',false,'value',null); end if;
 select ends_at+interval '7 days' into finish from public.seasons where id=measurement.season_id;
 select value into rating from private.room_measurement_ratings where measurement_id=measurement.id and player_id=actor and publication_id=target_publication_id order by received_at desc,id desc limit 1;
 return jsonb_build_object('seasonId',measurement.season_id,'eligible',statement_timestamp()<=finish,'value',rating,'closesAt',finish);
end $$;

drop trigger guard_product_experiment_launch on public.seasons;
drop trigger audit_product_publication_change on public.scheduled_challenges;
drop trigger guard_experiment_definition on private.product_experiments;
drop trigger set_product_publication_scope on private.product_experiment_publications;
drop function public.get_superadmin_product_experiments(uuid);
drop function public.get_superadmin_product_experiment(uuid);
drop function public.manage_product_experiment(jsonb);
drop function public.record_product_event(jsonb);
drop function public.read_my_product_rating(uuid);
drop function public.save_my_product_rating(jsonb);
drop function public.purge_product_measurements();
drop function public.get_my_product_instruments(uuid);
drop function public.get_superadmin_product_records(uuid,text,timestamptz,timestamptz,uuid,integer);
drop function public.get_superadmin_product_snapshot(uuid,uuid);
drop function public.get_superadmin_product_experiment_header(uuid);
drop function public.start_superadmin_room_measurement(uuid,uuid);
drop function public.get_superadmin_room_measurement(uuid);
drop function private.guard_product_experiment_launch();
drop function private.audit_product_publication_change();
drop function private.guard_experiment_definition();
drop function private.set_product_publication_scope();
drop table private.product_events;
drop table private.product_ratings;
drop table private.product_experiment_journal;
drop table private.product_measurement_snapshots;
drop table private.product_measurement_commands;
drop table private.product_experiment_participants;
drop table private.product_experiment_publications;
drop table private.product_experiments;
drop function private.validate_experiment_definition(jsonb);
drop function private.tabarnia_experiment_definition();
alter table private.room_measurements drop column created_by_player_id;
