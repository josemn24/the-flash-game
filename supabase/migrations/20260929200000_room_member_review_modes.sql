-- Generalize persisted member review to Flash, Survival and Pyramid.
-- Historical payloads remain behind this authenticated, security-definer RPC.

create function public.get_room_member_review(
  target_room_slug text,
  target_publication_id uuid,
  target_player_id uuid
)
returns table (
  room_id uuid, room_slug text, room_title text, viewer_role text,
  season_id uuid, season_title text, publication_id uuid,
  publication_status text, publication_closes_at timestamptz,
  challenge_id uuid, challenge_slug text, challenge_version_id uuid,
  challenge_title text, challenge_subtitle text, challenge_description text,
  challenge_mode text, challenge_max_score integer, question_count bigint,
  initial_lives integer, player_id uuid, display_name text, avatar_path text,
  attempt_id uuid, attempt_status text, attempt_score integer,
  attempt_outcome text, attempt_started_at timestamptz,
  attempt_completed_at timestamptz, attempt_duration_ms bigint,
  attempt_lock_version bigint, challenge_item_id uuid, item_position integer,
  question_version_id uuid, question_type text, payload_schema_version integer,
  time_limit_ms integer, public_payload jsonb, solution_payload jsonb,
  answer jsonb, answer_status text, points integer, result_details jsonb,
  presented_at timestamptz, submitted_at timestamptz, time_used_ms bigint,
  item_points integer, has_persisted_answer boolean, level_id text,
  level_label text, briefing_title text, briefing_format text,
  briefing_description text
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
      r.id as room_id, r.slug as room_slug, r.title as room_title,
      v.viewer_role, s.id as season_id, s.title as season_title,
      sc.id as publication_id, sc.status as publication_status,
      sc.closes_at as publication_closes_at, cd.id as challenge_id,
      cd.slug as challenge_slug, cv.id as challenge_version_id,
      cv.title as challenge_title, cv.subtitle as challenge_subtitle,
      cv.description as challenge_description, cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (select count(*)::bigint from private.challenge_items item
        where item.challenge_version_id = cv.id) as question_count,
      case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end
        as initial_lives,
      a.id as attempt_id, a.status as attempt_status, a.score as attempt_score,
      a.outcome as attempt_outcome, a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      (extract(epoch from (coalesce(a.completed_at, a.started_at) - a.started_at)) * 1000)::bigint
        as attempt_duration_ms,
      a.lock_version as attempt_lock_version, v.player_id as viewer_player_id
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
    where cv.mode in ('flash', 'survival', 'pyramid')
      and v.viewer_role in ('owner', 'admin', 'member')
      and cv.status in ('published', 'archived')
      and exists (
        select 1 from public.room_memberships historical_membership
        where historical_membership.room_id = r.id
          and historical_membership.player_id = target_player_id
      )
      and (
        (target_player_id = v.player_id and sc.status in ('open', 'closed'))
        or (
          target_player_id <> v.player_id
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
    a.room_id, a.room_slug, a.room_title, a.viewer_role, a.season_id,
    a.season_title, a.publication_id, a.publication_status,
    a.publication_closes_at, a.challenge_id, a.challenge_slug,
    a.challenge_version_id, a.challenge_title, a.challenge_subtitle,
    a.challenge_description, a.challenge_mode, a.challenge_max_score,
    a.question_count, a.initial_lives, target_player_id, p.display_name,
    p.avatar_path, a.attempt_id, a.attempt_status, a.attempt_score,
    a.attempt_outcome, a.attempt_started_at, a.attempt_completed_at,
    a.attempt_duration_ms, a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null
      else q.public_payload end,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null
      else qs.solution_payload end,
    aa.answer, aa.status, aa.points, aa.result_details, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points, aa.id is not null,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'levelId' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'label' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'title' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'format' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'description' end
  from authorized_attempt a
  join public.players p on p.id = target_player_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  where a.challenge_mode <> 'survival' or aa.id is not null
  order by i.position
$$;

create or replace function public.get_flash_member_review(
  target_room_slug text, target_publication_id uuid, target_player_id uuid
)
returns table (
  room_id uuid, room_slug text, room_title text, viewer_role text,
  publication_id uuid, publication_status text, publication_closes_at timestamptz,
  challenge_id uuid, challenge_slug text, challenge_version_id uuid,
  challenge_title text, challenge_subtitle text, challenge_description text,
  challenge_mode text, challenge_max_score integer, player_id uuid,
  display_name text, avatar_path text, attempt_id uuid, attempt_status text,
  attempt_score integer, attempt_started_at timestamptz,
  attempt_completed_at timestamptz, attempt_lock_version bigint,
  challenge_item_id uuid, item_position integer, question_version_id uuid,
  question_type text, payload_schema_version integer, time_limit_ms integer,
  public_payload jsonb, solution_payload jsonb, answer jsonb,
  answer_status text, points integer, result_details jsonb,
  presented_at timestamptz, submitted_at timestamptz, time_used_ms bigint,
  item_points integer
)
language sql stable security definer set search_path = '' as $$
  select
    review.room_id, review.room_slug, review.room_title, review.viewer_role,
    review.publication_id, review.publication_status, review.publication_closes_at,
    review.challenge_id, review.challenge_slug, review.challenge_version_id,
    review.challenge_title, review.challenge_subtitle, review.challenge_description,
    review.challenge_mode, review.challenge_max_score, review.player_id,
    review.display_name, review.avatar_path, review.attempt_id, review.attempt_status,
    review.attempt_score, review.attempt_started_at, review.attempt_completed_at,
    review.attempt_lock_version, review.challenge_item_id, review.item_position,
    review.question_version_id, review.question_type, review.payload_schema_version,
    review.time_limit_ms, review.public_payload, review.solution_payload, review.answer,
    review.answer_status, review.points, review.result_details, review.presented_at,
    review.submitted_at, review.time_used_ms, review.item_points
  from public.get_room_member_review(
    target_room_slug, target_publication_id, target_player_id
  ) review
  where review.challenge_mode = 'flash'
$$;

alter function public.get_room_member_review(text, uuid, uuid) owner to postgres;
alter function public.get_flash_member_review(text, uuid, uuid) owner to postgres;
revoke all on function public.get_room_member_review(text, uuid, uuid),
  public.get_flash_member_review(text, uuid, uuid)
  from public, anon, service_role;
grant execute on function public.get_room_member_review(text, uuid, uuid),
  public.get_flash_member_review(text, uuid, uuid) to authenticated;
