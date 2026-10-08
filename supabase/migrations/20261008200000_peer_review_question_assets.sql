-- Allow authorized daily-review readers to resolve private question assets.
begin;
set local check_function_bodies = off;

create or replace function private.can_review_competitive_attempt(target_attempt_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  with target as (
    select
      a.id as attempt_id,
      a.player_id as target_player_id,
      a.status as attempt_status,
      a.scheduled_challenge_id as publication_id,
      r.id as room_id,
      private.publication_effective_status(
        sc.status, s.status, s.starts_at, s.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      ) as publication_status
    from public.attempts a
    join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
    join public.seasons s on s.id = sc.season_id
    join public.rooms r on r.id = s.room_id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where a.id = target_attempt_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
      and r.status = 'active'
      and s.status in ('active', 'finished')
      and cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')
      and cv.status in ('published', 'archived')
  )
  select exists (
    select 1
    from target t
    join public.room_memberships viewer_membership
      on viewer_membership.room_id = t.room_id
      and viewer_membership.player_id = private.current_player_id()
      and viewer_membership.status = 'active'
      and viewer_membership.role in ('owner', 'admin', 'member')
    where exists (
      select 1
      from public.room_memberships historical_membership
      where historical_membership.room_id = t.room_id
        and historical_membership.player_id = t.target_player_id
    )
      and (
        (
          t.target_player_id = private.current_player_id()
          and t.publication_status in ('available', 'closed')
        )
        or (
          t.target_player_id <> private.current_player_id()
          and (
            (
              t.publication_status = 'available'
              and t.attempt_status = 'completed'
              and exists (
                select 1
                from public.attempts viewer_completed
                where viewer_completed.scheduled_challenge_id = t.publication_id
                  and viewer_completed.player_id = private.current_player_id()
                  and viewer_completed.kind = 'competitive'
                  and viewer_completed.status = 'completed'
              )
            )
            or (
              t.publication_status = 'closed'
              and not exists (
                select 1
                from public.attempts in_progress
                where in_progress.scheduled_challenge_id = t.publication_id
                  and in_progress.status = 'in_progress'
              )
            )
          )
        )
      )
  );
$$;

create or replace function public.get_room_member_review(
  target_room_slug text,
  target_publication_id uuid,
  target_player_id uuid
)
returns table (
  room_id                 uuid,
  room_slug               text,
  room_title              text,
  viewer_role             text,
  season_id               uuid,
  season_title            text,
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
  question_count          bigint,
  initial_lives           integer,
  player_id               uuid,
  display_name            text,
  avatar_path             text,
  attempt_id              uuid,
  attempt_status          text,
  attempt_score           integer,
  attempt_outcome         text,
  attempt_started_at      timestamptz,
  attempt_completed_at    timestamptz,
  attempt_duration_ms     bigint,
  attempt_lock_version    bigint,
  challenge_item_id       uuid,
  item_position           integer,
  question_version_id     uuid,
  question_type           text,
  payload_schema_version  integer,
  time_limit_ms           integer,
  public_payload          jsonb,
  solution_payload        jsonb,
  answer                  jsonb,
  answer_status           text,
  points                  integer,
  result_details          jsonb,
  presented_at            timestamptz,
  submitted_at            timestamptz,
  time_used_ms            bigint,
  item_points             integer,
  has_persisted_answer    boolean,
  level_id                text,
  level_label             text,
  briefing_title          text,
  briefing_format         text,
  briefing_description    text,
  global_time_limit_ms    integer,
  alphabet_letter         text
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
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      case when availability.status = 'available' then 'open' else availability.status end
        as publication_status,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      case when cv.mode = 'alphabet' then cv.global_time_limit_ms end as global_time_limit_ms,
      (select count(*)::bigint from private.challenge_items item
        where item.challenge_version_id = cv.id) as question_count,
      case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end as initial_lives,
      a.id as attempt_id,
      a.status as attempt_status,
      a.score as attempt_score,
      a.outcome as attempt_outcome,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      (extract(epoch from (coalesce(a.completed_at, a.started_at) - a.started_at)) * 1000)::bigint
        as attempt_duration_ms,
      a.lock_version as attempt_lock_version,
      v.player_id as viewer_player_id
    from viewer v
    join public.rooms r on r.id = v.room_id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    cross join lateral (
      select private.publication_effective_status(
        sc.status, s.status, s.starts_at, s.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      ) as status
    ) availability
    where cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')
      and cv.status in ('published', 'archived')
      and private.can_review_competitive_attempt(a.id)
  )
  select
    a.room_id, a.room_slug, a.room_title, a.viewer_role,
    a.season_id, a.season_title, a.publication_id, a.publication_status,
    a.publication_closes_at,
    a.challenge_id, a.challenge_slug, a.challenge_version_id, a.challenge_title,
    a.challenge_subtitle, a.challenge_description, a.challenge_mode,
    a.challenge_max_score, a.question_count, a.initial_lives, target_player_id,
    p.display_name, p.avatar_path,
    a.attempt_id, a.attempt_status, a.attempt_score, a.attempt_outcome,
    a.attempt_started_at, a.attempt_completed_at, a.attempt_duration_ms,
    a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null else q.public_payload end,
    case when a.challenge_mode = 'pyramid' and aa.id is null then null else qs.solution_payload end,
    aa.answer, aa.status, aa.points, aa.result_details, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points, aa.id is not null,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'levelId' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->>'label' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'title' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'format' end,
    case when a.challenge_mode = 'pyramid' then i.mode_config->'briefing'->>'description' end,
    a.global_time_limit_ms,
    case when a.challenge_mode = 'alphabet' then i.mode_config->>'letter' end
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

create or replace function private.read_competitive_question_asset(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result
  from public.attempts attempt
  join private.challenge_items item on item.challenge_version_id = attempt.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  join private.media_assets asset on asset.id = coalesce(
    question.public_payload->'surface'->>'assetId',
    question.public_payload->'media'->>'assetId'
  )::uuid
  where attempt.id = (input->>'attemptId')::uuid
    and attempt.kind = 'competitive'
    and private.can_review_competitive_attempt(attempt.id)
    and item.question_version_id is not null
    and question.payload_schema_version = 2
    and (
      (question.type = 'progressive-image' and question.public_payload->'surface' ? 'assetId')
      or (question.type = 'multiple-choice' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'estimation' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'heat-map' and question.public_payload->'surface' ? 'assetId')
    )
    and asset.kind = 'question-asset' and asset.status in ('ready','archived')
    and asset.id = (input->>'assetId')::uuid;
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
exception when invalid_text_representation then
  raise exception 'not_authorized' using errcode = '42501';
end;
$$;

alter function private.can_review_competitive_attempt(uuid) owner to postgres;
alter function public.get_room_member_review(text, uuid, uuid) owner to postgres;
alter function private.read_competitive_question_asset(jsonb) owner to postgres;
revoke all on function private.can_review_competitive_attempt(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_room_member_review(text, uuid, uuid),
  private.read_competitive_question_asset(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.get_room_member_review(text, uuid, uuid)
  to authenticated;
grant execute on function private.read_competitive_question_asset(jsonb)
  to service_role;

commit;
