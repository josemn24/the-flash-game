-- Definer helpers intentionally bypass table RLS to avoid recursive membership/profile
-- policies. They derive identity exclusively from Auth, never from a supplied player ID.
-- Empty search_path, fully qualified relations, no dynamic SQL, no exposed private RPCs.
create function private.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active'
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
$$;

-- The first application write is a narrow Auth-backed RPC. It intentionally has no
-- player/auth ID argument: the verified Auth claim is the only identity source.
create function public.provision_player()
returns table (
  player_id   uuid,
  display_name text,
  avatar_path text,
  status      text
)
language plpgsql volatile security definer set search_path = '' as $$
declare
  auth_user uuid := (select auth.uid());
  initial_name text := btrim(coalesce((select auth.jwt()) -> 'user_metadata' ->> 'display_name', ''));
begin
  if auth_user is null
    or coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'false' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if initial_name = '' or char_length(initial_name) not between 2 and 24 then
    initial_name := 'Jugador';
  end if;

  insert into public.players (auth_user_id, display_name)
  values (auth_user, initial_name)
  on conflict (auth_user_id) do nothing;

  select p.id, p.display_name, p.avatar_path, p.status
    into player_id, display_name, avatar_path, status
  from public.players p
  where p.auth_user_id = auth_user and p.status = 'active';

  if not found then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return next;
end;
$$;

create function private.is_room_member(target_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_memberships m
    join public.rooms r on r.id = m.room_id
    where m.room_id = target_room_id and m.player_id = (select private.current_player_id())
      and m.status = 'active' and r.status = 'active'
  )
$$;

create function private.can_read_profile(target_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_player_id = (select private.current_player_id()) or exists (
    select 1 from public.room_memberships mine
    join public.room_memberships peer on peer.room_id = mine.room_id
    join public.rooms r on r.id = mine.room_id
    where mine.player_id = (select private.current_player_id()) and mine.status = 'active'
      and peer.player_id = target_player_id and peer.status = 'active' and r.status = 'active'
  )
$$;

create function private.can_read_own_attempt(target_publication_id uuid, target_player_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_player_id = (select private.current_player_id()) and exists (
    select 1 from public.scheduled_challenges sc
    join public.seasons s on s.id = sc.season_id
    where sc.id = target_publication_id and private.is_room_member(s.room_id)
  )
$$;

-- Ownership is fixed explicitly; do not reassign these helpers to an API role.
alter function private.current_player_id() owner to postgres;
alter function private.is_room_member(uuid) owner to postgres;
alter function private.can_read_profile(uuid) owner to postgres;
alter function private.can_read_own_attempt(uuid, uuid) owner to postgres;
alter function public.provision_player() owner to postgres;

revoke all on function public.provision_player() from public;
grant execute on function public.provision_player() to authenticated;
