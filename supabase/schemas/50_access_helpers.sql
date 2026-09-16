-- Definer helpers intentionally bypass table RLS to avoid recursive membership/profile
-- policies. They derive identity exclusively from Auth, never from a supplied player ID.
-- Empty search_path, fully qualified relations, no dynamic SQL, no exposed private RPCs.
create function private.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active'
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
$$;

-- Shared by the editorial and calendar boundaries to keep private answers out of
-- public payloads and to verify that scheduled content remains S11-compatible.
create function private.editorial_has_secret_key(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when value is null then false
    when jsonb_typeof(value) = 'object' then exists (
      select 1
      from jsonb_each(value) as item(key, nested)
      where item.key in ('answer', 'correctAnswer', 'explanation', 'solution', 'solutionPayload')
        or private.editorial_has_secret_key(item.nested)
    )
    when jsonb_typeof(value) = 'array' then exists (
      select 1 from jsonb_array_elements(value) as item(nested)
      where private.editorial_has_secret_key(item.nested)
    )
    else false
  end;
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

-- The stored publication status is advanced by the local tick, but reads and
-- competitive writes must agree at the exact PostgreSQL instant even if the
-- tick is delayed. The season boundary is part of the effective state.
create function private.publication_effective_status(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns text
language sql stable set search_path = '' as $$
  select case
    when raw_status = 'cancelled' then 'cancelled'
    when raw_status = 'closed' then 'closed'
    when season_status <> 'active' then 'closed'
    when at_time < season_starts_at or at_time < opens_at then 'upcoming'
    when at_time >= season_ends_at or at_time >= closes_at then 'closed'
    else 'available'
  end
$$;

create function private.publication_is_effectively_open(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns boolean
language sql stable set search_path = '' as $$
  select private.publication_effective_status(
    raw_status, season_status, season_starts_at, season_ends_at,
    opens_at, closes_at, at_time
  ) = 'available'
$$;

-- Ownership is fixed explicitly; do not reassign these helpers to an API role.
alter function private.current_player_id() owner to postgres;
alter function private.is_room_member(uuid) owner to postgres;
alter function private.can_read_profile(uuid) owner to postgres;
alter function private.can_read_own_attempt(uuid, uuid) owner to postgres;
alter function private.publication_effective_status(text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) owner to postgres;
alter function private.publication_is_effectively_open(text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) owner to postgres;
alter function public.provision_player() owner to postgres;

revoke all on function public.provision_player() from public;
grant execute on function public.provision_player() to authenticated;
