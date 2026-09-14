-- Definer helpers intentionally bypass table RLS to avoid recursive membership/profile
-- policies. They derive identity exclusively from Auth, never from a supplied player ID.
-- Empty search_path, fully qualified relations, no dynamic SQL, no exposed private RPCs.
create function private.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active'
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
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

