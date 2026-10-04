SET local check_function_bodies = off;

DROP FUNCTION "public"."get_room_member_review"(text, uuid, uuid);

CREATE OR REPLACE FUNCTION private.expire_stale_attempts (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  run_id_value text;
  attempt_id_value uuid;
  room_slug_value text;
  now_value timestamptz;
  attempt_row public.attempts%rowtype;
  abandoned_count integer := 0;
  before_payload jsonb;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'attempt_expiration_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['runId','attemptId','roomSlug'])
    )
    or jsonb_typeof(input->'runId') is distinct from 'string'
    or (input ? 'attemptId' and jsonb_typeof(input->'attemptId') is distinct from 'string')
    or (input ? 'roomSlug' and jsonb_typeof(input->'roomSlug') is distinct from 'string')
    or (input ? 'attemptId' and input ? 'roomSlug') then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;

  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;
  if input ? 'attemptId' then
    begin
      attempt_id_value := (input->>'attemptId')::uuid;
    exception when others then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end;
  end if;
  if input ? 'roomSlug' then
    room_slug_value := btrim(input->>'roomSlug');
    if char_length(room_slug_value) = 0 or char_length(room_slug_value) > 160 then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  for attempt_row in
    select attempt.*
    from public.attempts attempt
    join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
    join public.seasons season on season.id = schedule.season_id
    join public.rooms room on room.id = season.room_id
    where attempt.kind = 'competitive'
      and attempt.status = 'in_progress'
      and coalesce(attempt.last_activity_at, attempt.started_at) <= now_value - interval '15 minutes'
      and (private.publication_effective_status(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, now_value
      ) = 'closed' or attempt.deadline_at <= now_value)
      and (attempt_id_value is null or attempt.id = attempt_id_value)
      and (room_slug_value is null or room.slug = room_slug_value)
    order by attempt.id
    for update of attempt skip locked
  loop
    before_payload := jsonb_build_object(
      'status', attempt_row.status,
      'lockVersion', attempt_row.lock_version,
      'score', attempt_row.score,
      'lastActivityAt', attempt_row.last_activity_at,
      'deadlineAt', attempt_row.deadline_at
    );

    update private.interaction_intervals interval_row
    set ended_at = greatest(interval_row.started_at, least(now_value, timing_unit.deadline_at)),
        end_reason = 'abandon'
    from private.attempt_timing_units timing_unit
    where interval_row.attempt_id = attempt_row.id
      and interval_row.ended_at is null
      and timing_unit.id = interval_row.timing_unit_id;

    delete from private.prepared_interactions where attempt_id = attempt_row.id;
    update public.attempts
    set status = 'abandoned',
        score = null,
        outcome = null,
        completed_at = now_value,
        progress_payload = null,
        terminal_reason = 'inactivity_timeout',
        lock_version = lock_version + 1
    where id = attempt_row.id
      and status = 'in_progress';
    if found then
      update private.attempt_sessions
      set revoked_at = now_value
      where attempt_id = attempt_row.id and revoked_at is null;

      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id,
        before_payload, after_payload
      ) values (
        null, 'expire_stale_attempt', 'attempt', attempt_row.id,
        '15 minutes without activity after challenge closure or deadline', run_id_value,
        before_payload,
        jsonb_build_object(
          'status', 'abandoned',
          'lockVersion', attempt_row.lock_version + 1,
          'score', null,
          'completedAt', now_value,
          'terminalReason', 'inactivity_timeout'
        )
      );
      abandoned_count := abandoned_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'runId', run_id_value,
    'evaluatedAt', now_value,
    'abandonedAttempts', abandoned_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_history (
  target_room_slug      text,
  target_publication_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    room_id               uuid,
    room_slug             text,
    room_title            text,
    viewer_role           text,
    season_id             uuid,
    season_title          text,
    publication_id        uuid,
    publication_number    integer,
    publication_status    text,
    publication_opens_at  timestamp with time zone,
    publication_closes_at timestamp with time zone,
    challenge_id          uuid,
    challenge_slug        text,
    challenge_version_id  uuid,
    challenge_title       text,
    challenge_subtitle    text,
    challenge_description text,
    challenge_mode        text,
    challenge_max_score   integer,
    question_count        bigint,
    played_at             timestamp with time zone,
    player_count          bigint,
    player_id             uuid,
    display_name          text,
    avatar_path           text,
    flash_points          bigint,
    duration_ms           bigint,
    started_at            timestamp with time zone,
    "position"            bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      sc.number as publication_number,
      'closed'::text as publication_status,
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
      (select count(*)::bigint
         from private.challenge_items i
        where i.challenge_version_id = cv.id) as question_count,
      coalesce((
        select max(a.completed_at)
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), sc.closes_at) as played_at,
      coalesce((
        select count(distinct a.player_id)::bigint
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), 0::bigint) as player_count
    from public.rooms r
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer v
    where r.slug = target_room_slug
      and sc.id = coalesce(target_publication_id, sc.id)
      and private.publication_effective_status(
        sc.status, s.status, s.starts_at, s.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      ) = 'closed'
      and cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')
      and cv.status in ('published', 'archived')
      and not exists (
        select 1 from public.attempts in_progress
        where in_progress.scheduled_challenge_id = sc.id
          and in_progress.status = 'in_progress'
      )
  ), ranked_results as (
    select
      e.scheduled_challenge_id as publication_id,
      e.player_id,
      p.display_name,
      p.avatar_path,
      e.flash_points,
      e.duration_ms,
      e.started_at,
      rank() over (
        partition by e.scheduled_challenge_id
        order by e.flash_points desc, e.duration_ms, e.started_at
      ) as "position"
    from private.effective_results e
    join eligible_publications h on h.publication_id = e.scheduled_challenge_id
    join public.players p on p.id = e.player_id
  )
  select
    h.room_id, h.room_slug, h.room_title, h.viewer_role,
    h.season_id, h.season_title, h.publication_id, h.publication_number,
    h.publication_status, h.publication_opens_at, h.publication_closes_at,
    h.challenge_id, h.challenge_slug, h.challenge_version_id, h.challenge_title,
    h.challenge_subtitle, h.challenge_description, h.challenge_mode,
    h.challenge_max_score, h.question_count, h.played_at, h.player_count,
    r.player_id, r.display_name, r.avatar_path, r.flash_points, r.duration_ms,
    r.started_at, r."position"
  from eligible_publications h
  left join ranked_results r on r.publication_id = h.publication_id
  order by h.played_at desc, h.publication_number desc, h.publication_id,
    r."position" nulls last, r.player_id
$function$;

CREATE OR REPLACE FUNCTION public.get_room_member_review (
  target_room_slug      text,
  target_publication_id uuid,
  target_player_id      uuid
)
  RETURNS TABLE (
    room_id                uuid,
    room_slug              text,
    room_title             text,
    viewer_role            text,
    season_id              uuid,
    season_title           text,
    publication_id         uuid,
    publication_status     text,
    publication_closes_at  timestamp with time zone,
    challenge_id           uuid,
    challenge_slug         text,
    challenge_version_id   uuid,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_mode         text,
    challenge_max_score    integer,
    question_count         bigint,
    initial_lives          integer,
    player_id              uuid,
    display_name           text,
    avatar_path            text,
    attempt_id             uuid,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_duration_ms    bigint,
    attempt_lock_version   bigint,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    time_limit_ms          integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    item_points            integer,
    has_persisted_answer   boolean,
    level_id               text,
    level_label            text,
    briefing_title         text,
    briefing_format        text,
    briefing_description   text,
    global_time_limit_ms   integer,
    alphabet_letter        text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
      and v.viewer_role in ('owner', 'admin', 'member')
      and cv.status in ('published', 'archived')
      and exists (
        select 1 from public.room_memberships historical_membership
        where historical_membership.room_id = r.id
          and historical_membership.player_id = target_player_id
      )
      and (
        (
          target_player_id = v.player_id
          and availability.status in ('available', 'closed')
        )
        or (
          target_player_id <> v.player_id
          and v.viewer_role in ('owner', 'admin', 'member')
          and availability.status = 'closed'
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
$function$;

REVOKE ALL ON FUNCTION "public"."get_room_member_review"(text, uuid, uuid) FROM PUBLIC, "anon", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_room_member_review"(text, uuid, uuid) TO "authenticated", "postgres";
