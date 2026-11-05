create function private.require_measurement_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_player_id();
begin
 if actor is null or not exists(select 1 from private.platform_role_assignments where player_id=actor and role='superadmin') then raise exception 'not_authorized' using errcode='42501'; end if;
 return actor;
end $$;
alter function private.require_measurement_admin() owner to postgres;
revoke all on function private.require_measurement_admin() from public,anon,authenticated,service_role;

-- Private season measurements and their automatically growing scope.
create table private.room_measurements (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id),
 season_id uuid not null references public.seasons(id),
 status text not null default 'running' check(status in ('running','closed')),
 started_at timestamptz not null default clock_timestamp(),
 closed_at timestamptz,
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
create unique index room_measurement_events_rehearsal_run_idx
 on private.room_measurement_events(measurement_id,player_id,publication_id,type,visit_id)
 where type in ('rehearsal_started','rehearsal_completed');
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
