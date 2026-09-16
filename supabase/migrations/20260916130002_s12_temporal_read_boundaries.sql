-- S12 — Apply the effective-clock reads and attempt admission guard to migrated databases.
-- The source schemas are included after replacing only the affected function objects.

drop function public.get_my_room_cards();
drop function public.get_room_detail(text);
drop function public.get_room_introduction(text, uuid);
-- S02 read projections. They are the only public boundary into private challenge metadata.
-- This file is intentionally ordered before 80_rankings.sql; defer body checking for
-- the forward reference used by current_position until the complete schema is loaded.
set local check_function_bodies = off;
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
  competitive_playable boolean,
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
    publication.competitive_playable,
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
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
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
      ) as question_count,
      (
        select count(*) = 2 and bool_and(q.type = 'multiple-choice')
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status = 'published'
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$$;

set local check_function_bodies = on;

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
  competitive_playable boolean,
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
  question_count      bigint,
  competitive_playable boolean,
  availability_status  text,
  can_start            boolean
)
language sql stable security definer set search_path = '' as $$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select count(*) = 2 and bool_and(question.type = 'multiple-choice')
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status = 'published'
  order by season.starts_at desc, schedule.number
$$;

alter function public.get_my_room_cards() owner to postgres;
alter function public.get_room_detail(text) owner to postgres;
alter function public.get_room_introduction(text, uuid) owner to postgres;

revoke all on function public.get_my_room_cards(), public.get_room_detail(text),
  public.get_room_introduction(text, uuid) from public, anon, service_role;
grant execute on function public.get_my_room_cards(), public.get_room_detail(text),
  public.get_room_introduction(text, uuid) to authenticated;

drop function public.get_my_flash_challenge(text, uuid);
drop function public.get_my_flash_result(uuid);
-- S03 competitive read boundary. These functions expose only the public question
-- payload while an attempt is playable and the owner's review after completion.
-- The private content tables remain outside the Data API.
create function public.get_my_flash_challenge(target_room_slug text, target_publication_id uuid)
returns table (
  room_id                 uuid,
  room_slug               text,
  room_title              text,
  publication_id          uuid,
  publication_status      text,
  publication_opens_at    timestamptz,
  publication_closes_at   timestamptz,
  challenge_id            uuid,
  challenge_slug          text,
  challenge_version_id    uuid,
  challenge_title         text,
  challenge_subtitle      text,
  challenge_description   text,
  challenge_mode          text,
  challenge_max_score     integer,
  question_count          bigint,
  own_attempt_id          uuid,
  own_attempt_status      text,
  own_attempt_score       integer,
  own_attempt_started_at  timestamptz,
  own_attempt_completed_at timestamptz,
  own_attempt_deadline_at timestamptz,
  own_attempt_lock_version bigint,
  challenge_item_id       uuid,
  item_position           integer,
  question_version_id     uuid,
  question_type           text,
  payload_schema_version  integer,
  time_limit_ms           integer,
  item_points             integer
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      a.id as own_attempt_id,
      a.status as own_attempt_status,
      a.score as own_attempt_score,
      a.started_at as own_attempt_started_at,
      a.completed_at as own_attempt_completed_at,
      a.deadline_at as own_attempt_deadline_at,
      a.lock_version as own_attempt_lock_version,
      cv.id as version_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer
    left join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = viewer.player_id and a.kind = 'competitive'
    where r.slug = target_room_slug
      and sc.id = target_publication_id
      and r.status = 'active'
      and m.player_id = viewer.player_id
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'member')
      and (
        private.publication_is_effectively_open(
          sc.status, s.status, s.starts_at, s.ends_at,
          sc.opens_at, sc.closes_at, statement_timestamp()
        )
        or a.id is not null
      )
      and cv.status = 'published'
      and cv.mode = 'flash'
  )
  select
    p.room_id, p.room_slug, p.room_title, p.publication_id, p.publication_status,
    p.publication_opens_at, p.publication_closes_at, p.challenge_id, p.challenge_slug,
    p.challenge_version_id, p.challenge_title, p.challenge_subtitle, p.challenge_description,
    p.challenge_mode, p.challenge_max_score,
    count(i.id) over (partition by p.challenge_version_id),
    p.own_attempt_id, p.own_attempt_status, p.own_attempt_score, p.own_attempt_started_at,
    p.own_attempt_completed_at, p.own_attempt_deadline_at, p.own_attempt_lock_version,
    i.id, i.position, q.id, q.type, q.payload_schema_version,
    q.time_limit_ms, i.points
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$$;

-- A completed attempt is the only state in which the owner's solution/review is
-- released. The function returns no rows for another player, another room, or an
-- in-progress attempt, making all those cases observationally equivalent.
create function public.get_my_flash_result(target_attempt_id uuid)
returns table (
  attempt_id              uuid,
  scheduled_challenge_id  uuid,
  challenge_item_id       uuid,
  item_position           integer,
  question_version_id     uuid,
  question_type           text,
  payload_schema_version  integer,
  public_payload          jsonb,
  solution_payload        jsonb,
  answer                  jsonb,
  answer_status           text,
  points                  integer,
  result_details          jsonb,
  presented_at            timestamptz,
  submitted_at            timestamptz,
  time_used_ms            bigint,
  attempt_status          text,
  attempt_score           integer,
  attempt_started_at      timestamptz,
  attempt_completed_at    timestamptz,
  attempt_lock_version    bigint,
  challenge_title         text,
  challenge_subtitle      text,
  challenge_description   text,
  challenge_max_score     integer
)
language sql stable security definer set search_path = '' as $$
  select
    a.id, a.scheduled_challenge_id, aa.challenge_item_id, i.position, aa.challenge_version_id,
    q.type, q.payload_schema_version, q.public_payload, qs.solution_payload, aa.answer,
    aa.status, aa.points, aa.result_details, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, a.score, a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id
    and a.player_id = private.current_player_id()
    and a.kind = 'competitive'
    and a.status = 'completed'
    and cv.mode = 'flash'
    and r.status = 'active'
    and m.player_id = private.current_player_id()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$$;

alter function public.get_my_flash_challenge(text, uuid) owner to postgres;
alter function public.get_my_flash_result(uuid) owner to postgres;
revoke all on function public.get_my_flash_challenge(text, uuid), public.get_my_flash_result(uuid)
  from public, anon, service_role;
grant execute on function public.get_my_flash_challenge(text, uuid), public.get_my_flash_result(uuid)
  to authenticated;

-- S12 migration companion: a delayed tick must not make a live window
-- unplayable, and a closed/finished window must reject new attempts.
create or replace function private.guard_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' then raise exception 'An attempt must start in progress'; end if;
    new.started_at := clock_timestamp();
    -- Derive the global clock from the exact persisted start, including very short limits.
    -- Other modes have only question/level clocks; never accept a caller's global deadline.
    select case when cv.mode = 'alphabet' then
      new.started_at + cv.global_time_limit_ms * interval '1 millisecond' else null end
      into new.deadline_at from private.challenge_versions cv where cv.id = new.challenge_version_id;
    if new.kind = 'competitive' then
      if exists (select 1 from private.platform_role_assignments where player_id = new.player_id) then
        raise exception 'Superadministrators only create test attempts';
      end if;
      perform 1 from public.scheduled_challenges sc
        join public.seasons s on s.id = sc.season_id
        join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id and m.player_id = new.player_id
        join public.players p on p.id = m.player_id
        where sc.id = new.scheduled_challenge_id
          and private.publication_is_effectively_open(
            sc.status, s.status, s.starts_at, s.ends_at,
            sc.opens_at, sc.closes_at, new.started_at
          )
          and r.status = 'active'
          and m.status = 'active' and m.role in ('owner', 'admin', 'member')
          and p.status = 'active' and p.auth_user_id is not null
        for share of sc, s, r, m, p;
      if not found then raise exception 'No competitive access or publication unavailable'; end if;
    else
      if not exists (select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
        where x.player_id = new.player_id and p.status = 'active' and p.auth_user_id is not null) then
        raise exception 'Test attempts require a superadministrator';
      end if;
    end if;
    return new;
  end if;
  if (new.id, new.player_id, new.scheduled_challenge_id, new.challenge_version_id, new.kind,
      new.attempt_number, new.started_at, new.deadline_at) is distinct from
     (old.id, old.player_id, old.scheduled_challenge_id, old.challenge_version_id, old.kind,
      old.attempt_number, old.started_at, old.deadline_at) then
    raise exception 'Attempt context is immutable';
  end if;
  if new.lock_version <> old.lock_version + 1 then raise exception 'Expected next lock_version'; end if;
  if old.status <> 'in_progress' then
    if new.status = old.status and (to_jsonb(new) - 'lock_version' - 'updated_at') =
      (to_jsonb(old) - 'lock_version' - 'updated_at') then return new; end if;
    if old.status not in ('completed', 'abandoned') or new.status <> 'invalidated'
      or (to_jsonb(new) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') <>
         (to_jsonb(old) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') then
      raise exception 'Terminal attempts cannot be replayed or overwritten';
    end if;
  elsif new.status = 'invalidated' then
    raise exception 'Complete or abandon before administrative invalidation';
  end if;
  return new;
end;
$$;

alter function private.guard_attempt() owner to postgres;
revoke all on function private.guard_attempt() from public, anon, authenticated, service_role;
