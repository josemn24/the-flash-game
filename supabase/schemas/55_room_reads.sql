-- S02 read projections. They are the only public boundary into private challenge metadata.
-- The current Auth identity is resolved from the verified claim; no player/room ownership
-- decision is delegated to a client-supplied identity.
create function public.get_my_room_cards()
returns table (
  room_id              uuid,
  room_slug            text,
  room_title           text,
  room_description     text,
  membership_role      text,
  season_id            uuid,
  season_title        text,
  season_status        text,
  season_starts_at    timestamptz,
  season_ends_at      timestamptz,
  publication_id       uuid,
  publication_status   text,
  opens_at             timestamptz,
  closes_at            timestamptz,
  challenge_title      text,
  challenge_subtitle   text,
  challenge_mode       text,
  challenge_max_score  integer,
  question_count       bigint,
  member_count         bigint,
  member_previews      jsonb,
  current_flash_points bigint,
  current_position     bigint
)
language sql stable security definer set search_path = '' as $$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    null::bigint
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and sc.status = 'open'
      and sc.opens_at <= statement_timestamp()
      and statement_timestamp() < sc.closes_at
      and cv.status = 'published'
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$$;

-- Detail deliberately reuses the same authorization and projection as the home card.
create function public.get_room_detail(target_room_slug text)
returns table (
  room_id              uuid,
  room_slug            text,
  room_title           text,
  room_description     text,
  membership_role      text,
  season_id            uuid,
  season_title        text,
  season_status        text,
  season_starts_at    timestamptz,
  season_ends_at      timestamptz,
  publication_id       uuid,
  publication_status   text,
  opens_at             timestamptz,
  closes_at            timestamptz,
  challenge_title      text,
  challenge_subtitle   text,
  challenge_mode       text,
  challenge_max_score  integer,
  question_count       bigint,
  member_count         bigint,
  member_previews      jsonb,
  current_flash_points bigint,
  current_position     bigint
)
language sql stable security definer set search_path = '' as $$
  select cards.*
  from public.get_my_room_cards() cards
  where cards.room_slug = target_room_slug
$$;

-- Introduction metadata is scoped by both the persisted room slug and publication id.
-- It cannot be used to fetch a private challenge version or any question payload.
create function public.get_room_introduction(target_room_slug text, target_publication_id uuid)
returns table (
  room_id             uuid,
  room_slug           text,
  room_title          text,
  membership_role     text,
  publication_id      uuid,
  publication_status  text,
  opens_at            timestamptz,
  closes_at           timestamptz,
  challenge_title     text,
  challenge_subtitle  text,
  challenge_mode      text,
  challenge_max_score integer,
  question_count      bigint
)
language sql stable security definer set search_path = '' as $$
  select
    cards.room_id,
    cards.room_slug,
    cards.room_title,
    cards.membership_role,
    cards.publication_id,
    cards.publication_status,
    cards.opens_at,
    cards.closes_at,
    cards.challenge_title,
    cards.challenge_subtitle,
    cards.challenge_mode,
    cards.challenge_max_score,
    cards.question_count
  from public.get_my_room_cards() cards
  where cards.room_slug = target_room_slug
    and cards.publication_id = target_publication_id
$$;

alter function public.get_my_room_cards() owner to postgres;
alter function public.get_room_detail(text) owner to postgres;
alter function public.get_room_introduction(text, uuid) owner to postgres;

revoke all on function public.get_my_room_cards(), public.get_room_detail(text),
  public.get_room_introduction(text, uuid) from public, anon, service_role;
grant execute on function public.get_my_room_cards(), public.get_room_detail(text),
  public.get_room_introduction(text, uuid) to authenticated;
