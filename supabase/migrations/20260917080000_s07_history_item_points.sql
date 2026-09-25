-- S07/E01: historical Flash review needs the frozen item score to rebuild
-- Mini-Wordle and multiple-choice questions after the attempt is terminal.
drop function if exists public.get_flash_member_review(text, uuid, uuid);

create function public.get_flash_member_review(
  target_room_slug text,
  target_publication_id uuid,
  target_player_id uuid
)
returns table (
  room_id                 uuid,
  room_slug               text,
  room_title              text,
  viewer_role             text,
  publication_id          uuid,
  publication_status      text,
  publication_closes_at   timestamptz,
  challenge_id            uuid,
  challenge_slug          text,
  challenge_version_id    uuid,
  challenge_title         text,
  challenge_subtitle      text,
  challenge_description   text,
  challenge_mode          text,
  challenge_max_score     integer,
  player_id               uuid,
  display_name             text,
  avatar_path             text,
  attempt_id              uuid,
  attempt_status           text,
  attempt_score            integer,
  attempt_started_at       timestamptz,
  attempt_completed_at     timestamptz,
  attempt_lock_version     bigint,
  challenge_item_id        uuid,
  item_position            integer,
  question_version_id      uuid,
  question_type            text,
  payload_schema_version   integer,
  time_limit_ms            integer,
  public_payload           jsonb,
  solution_payload         jsonb,
  answer                   jsonb,
  answer_status            text,
  points                  integer,
  result_details           jsonb,
  presented_at             timestamptz,
  submitted_at             timestamptz,
  time_used_ms             bigint,
  item_points              integer
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select p.id as player_id, m.role as viewer_role, r.id as room_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), authorized_attempt as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      a.id as attempt_id,
      a.status as attempt_status,
      a.score as attempt_score,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      a.lock_version as attempt_lock_version,
      v.player_id as viewer_player_id
    from viewer v
    join public.rooms r on r.id = v.room_id
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    where cv.mode = 'flash'
      and cv.status in ('published', 'archived')
      and exists (
        select 1 from public.room_memberships historical_membership
        where historical_membership.room_id = r.id
          and historical_membership.player_id = target_player_id
      )
      and (
        (
          target_player_id = v.player_id
          and sc.status in ('open', 'closed')
        )
        or (
          target_player_id <> v.player_id
          and v.viewer_role in ('owner', 'admin', 'member')
          and sc.status = 'closed'
          and not exists (
            select 1 from public.attempts in_progress
            where in_progress.scheduled_challenge_id = sc.id
              and in_progress.status = 'in_progress'
          )
        )
      )
  )
  select
    a.room_id, a.room_slug, a.room_title, a.viewer_role,
    a.publication_id, a.publication_status, a.publication_closes_at,
    a.challenge_id, a.challenge_slug, a.challenge_version_id, a.challenge_title,
    a.challenge_subtitle, a.challenge_description, a.challenge_mode,
    a.challenge_max_score, target_player_id, p.display_name, p.avatar_path,
    a.attempt_id, a.attempt_status, a.attempt_score, a.attempt_started_at,
    a.attempt_completed_at, a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms, q.public_payload, qs.solution_payload,
    aa.answer, aa.status, aa.points, aa.result_details, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points
  from authorized_attempt a
  join public.players p on p.id = target_player_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  order by i.position
$$;

alter function public.get_flash_member_review(text, uuid, uuid) owner to postgres;
revoke all on function public.get_flash_member_review(text, uuid, uuid) from public, anon, service_role;
grant execute on function public.get_flash_member_review(text, uuid, uuid) to authenticated;
