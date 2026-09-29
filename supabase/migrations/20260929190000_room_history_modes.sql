-- Generalize the persisted room history projection to the competitive modes
-- currently supported by the room surface, while preserving the old Flash RPC.

create function public.get_room_history(
  target_room_slug text,
  target_publication_id uuid default null
)
returns table (
  room_id uuid, room_slug text, room_title text, viewer_role text,
  season_id uuid, season_title text, publication_id uuid,
  publication_number integer, publication_status text,
  publication_opens_at timestamptz, publication_closes_at timestamptz,
  challenge_id uuid, challenge_slug text, challenge_version_id uuid,
  challenge_title text, challenge_subtitle text, challenge_description text,
  challenge_mode text, challenge_max_score integer, question_count bigint,
  played_at timestamptz, player_count bigint, player_id uuid,
  display_name text, avatar_path text, flash_points bigint,
  duration_ms bigint, started_at timestamptz, "position" bigint
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select p.id as player_id, m.role as viewer_role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), eligible_publications as (
    select
      r.id as room_id, r.slug as room_slug, r.title as room_title,
      v.viewer_role, s.id as season_id, s.title as season_title,
      sc.id as publication_id, sc.number as publication_number,
      sc.status as publication_status, sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at, cd.id as challenge_id,
      cd.slug as challenge_slug, cv.id as challenge_version_id,
      cv.title as challenge_title, cv.subtitle as challenge_subtitle,
      cv.description as challenge_description, cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (select count(*)::bigint from private.challenge_items i
        where i.challenge_version_id = cv.id) as question_count,
      coalesce((select max(a.completed_at) from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')), sc.closes_at) as played_at,
      coalesce((select count(distinct a.player_id)::bigint from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')), 0::bigint) as player_count
    from public.rooms r
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer v
    where r.slug = target_room_slug
      and sc.id = coalesce(target_publication_id, sc.id)
      and sc.status = 'closed'
      and cv.mode in ('flash', 'survival', 'pyramid')
      and cv.status in ('published', 'archived')
      and not exists (select 1 from public.attempts in_progress
        where in_progress.scheduled_challenge_id = sc.id
          and in_progress.status = 'in_progress')
  ), ranked_results as (
    select e.scheduled_challenge_id as publication_id, e.player_id,
      p.display_name, p.avatar_path, e.flash_points, e.duration_ms,
      e.started_at,
      rank() over (partition by e.scheduled_challenge_id
        order by e.flash_points desc, e.duration_ms, e.started_at) as "position"
    from private.effective_results e
    join eligible_publications h on h.publication_id = e.scheduled_challenge_id
    join public.players p on p.id = e.player_id
  )
  select h.room_id, h.room_slug, h.room_title, h.viewer_role,
    h.season_id, h.season_title, h.publication_id, h.publication_number,
    h.publication_status, h.publication_opens_at, h.publication_closes_at,
    h.challenge_id, h.challenge_slug, h.challenge_version_id,
    h.challenge_title, h.challenge_subtitle, h.challenge_description,
    h.challenge_mode, h.challenge_max_score, h.question_count, h.played_at,
    h.player_count, r.player_id, r.display_name, r.avatar_path,
    r.flash_points, r.duration_ms, r.started_at, r."position"
  from eligible_publications h
  left join ranked_results r on r.publication_id = h.publication_id
  order by h.played_at desc, h.publication_number desc, h.publication_id,
    r."position" nulls last, r.player_id
$$;

create or replace function public.get_flash_history(
  target_room_slug text,
  target_publication_id uuid default null
)
returns table (
  room_id uuid, room_slug text, room_title text, viewer_role text,
  season_id uuid, season_title text, publication_id uuid,
  publication_number integer, publication_status text,
  publication_opens_at timestamptz, publication_closes_at timestamptz,
  challenge_id uuid, challenge_slug text, challenge_version_id uuid,
  challenge_title text, challenge_subtitle text, challenge_description text,
  challenge_mode text, challenge_max_score integer, question_count bigint,
  played_at timestamptz, player_count bigint, player_id uuid,
  display_name text, avatar_path text, flash_points bigint,
  duration_ms bigint, started_at timestamptz, "position" bigint
)
language sql stable security definer set search_path = '' as $$
  select history.*
  from public.get_room_history(target_room_slug, target_publication_id) history
  where history.challenge_mode = 'flash'
$$;

alter function public.get_room_history(text, uuid) owner to postgres;
alter function public.get_flash_history(text, uuid) owner to postgres;
revoke all on function public.get_room_history(text, uuid),
  public.get_flash_history(text, uuid) from public, anon, service_role;
grant execute on function public.get_room_history(text, uuid),
  public.get_flash_history(text, uuid) to authenticated;
