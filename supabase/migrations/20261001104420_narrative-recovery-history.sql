SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.assert_supported_calendar_content (
  version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  version_status text;
  version_mode text;
  version_schema integer;
  version_score integer;
  version_config jsonb;
  item_count integer;
  compatible_item_count integer;
  solution_count integer;
  points_total integer;
begin
  select version.status, version.mode, version.config_schema_version, version.max_score, version.mode_config
    into version_status, version_mode, version_schema, version_score, version_config
  from private.challenge_versions version
  where version.id = version_id;

  if not found then
    raise exception 'content_not_found' using errcode = '22023';
  end if;
  if version_status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_mode not in ('flash', 'survival', 'narrative', 'pyramid') then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;

  select count(*)::integer,
    count(*) filter (
      where item.position between 1 and 20
        and item.points > 0
        and item.config_schema_version = 1
        and (version_mode = 'pyramid'
          and private.is_valid_pyramid_level_config(item.mode_config)
          or version_mode = 'narrative'
          and jsonb_typeof(item.mode_config) = 'object'
          and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version_mode not in ('pyramid', 'narrative') and item.mode_config = '{}'::jsonb)
        and private.is_supported_flash_question(question.id)
    )::integer,
    coalesce(sum(item.points), 0)::integer
  into item_count, compatible_item_count, points_total
  from private.challenge_items item
  left join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = version_id;

  select count(*)::integer into solution_count
  from private.challenge_items item
  join private.question_version_solutions solution
    on solution.question_version_id = item.question_version_id
  where item.challenge_version_id = version_id;

  if version_schema <> 1 or version_score <> 100
    or (version_mode = 'flash' and version_config <> '{}'::jsonb)
    or (version_mode = 'survival' and (
      (select count(*) from jsonb_object_keys(version_config)) <> 1
      or jsonb_typeof(version_config->'lives') is distinct from 'number'
      or (version_config->>'lives')::numeric <> trunc((version_config->>'lives')::numeric)
      or (version_config->>'lives')::integer not between 1 and item_count
    ))
    or (version_mode = 'narrative' and (
      jsonb_typeof(version_config) is distinct from 'object'
      or jsonb_typeof(version_config->'prologue') is distinct from 'object'
      or jsonb_typeof(version_config->'beats') is distinct from 'array'
    ))
    or (version_mode = 'pyramid' and (
      version_config <> '{}'::jsonb or item_count <> 7
      or (select count(distinct item.mode_config->>'levelId')
        from private.challenge_items item where item.challenge_version_id = version_id) <> 7
      or exists (select 1 from private.challenge_items item
        where item.challenge_version_id = version_id and item.position not between 1 and 7)
    ))
    or (version_mode <> 'pyramid' and item_count not between 2 and 20)
    or compatible_item_count <> item_count
    or solution_count <> item_count
    or points_total <> 100 then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_attempt_recovery (
  target_attempt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status,
    'lockVersion', a.lock_version,
    'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'hasOpenInteraction', exists (select 1 from private.interaction_intervals interval_row
      where interval_row.attempt_id = a.id and interval_row.ended_at is null),
    'narrativeCursor', case when cv.mode = 'narrative' then jsonb_build_object(
      'currentChallengeItemId', (select interval_row.challenge_item_id
        from private.interaction_intervals interval_row
        where interval_row.attempt_id = a.id and interval_row.ended_at is null
        order by interval_row.started_at desc limit 1),
      'nextChallengeItemId', (select item.id
        from private.challenge_items item
        where item.challenge_version_id = a.challenge_version_id
          and not exists (select 1 from private.attempt_answers answer
            where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
        order by item.position limit 1)
    ) else null end,
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id
      and not exists (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'challengeMode', cv.mode,
    'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer else null end,
    'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
      select sum(case
        when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
        when question.type = 'queens'
          and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
        else 0 end)::integer
      from private.attempt_answers answer
      join private.challenge_items item on item.id = answer.challenge_item_id
      join private.question_versions question on question.id = item.question_version_id
      where answer.attempt_id = a.id
    ), 0), 0) else null end,
    'terminalOutcome', case when cv.mode = 'survival' and (
      greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when question.type = 'queens'
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions question on question.id = item.question_version_id
        where answer.attempt_id = a.id
      ), 0), 0) = 0
    ) then 'eliminated' when cv.mode = 'survival' and not exists (
      select 1 from private.challenge_items item where item.challenge_version_id = a.challenge_version_id
        and not exists (select 1 from private.attempt_answers answer where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
    ) then 'survived'
      when cv.mode = 'pyramid' and exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then 'failed'
      when cv.mode = 'pyramid' and (
        select count(*) from private.attempt_answers answer where answer.attempt_id = a.id
      ) = 7 then 'summit'
      else null end,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
      'status', aa.status, 'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms,
      'resultDetails', aa.result_details) order by i.position)
      from private.attempt_answers aa join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)
  ) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive'
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_calendar (
  target_room_slug text
)
  RETURNS TABLE (
    room_id             uuid,
    room_slug           text,
    room_title          text,
    time_zone           text,
    membership_role     text,
    season_id           uuid,
    season_title        text,
    season_status       text,
    publication_id      uuid,
    publication_number  integer,
    publication_status  text,
    availability_status text,
    opens_at            timestamp with time zone,
    closes_at           timestamp with time zone,
    challenge_title     text,
    challenge_subtitle  text,
    challenge_mode      text,
    question_count      bigint,
    own_attempt_status  text,
    can_start           boolean,
    can_continue        boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and (
      version.mode = 'flash' and version.mode_config = '{}'::jsonb
      or version.mode = 'survival'
        and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
        and jsonb_typeof(version.mode_config->'lives') = 'number'
        and (version.mode_config->>'lives')::integer between 1 and compatibility.question_count
      or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
        and compatibility.question_count = 7
      or version.mode = 'narrative'
        and jsonb_typeof(version.mode_config) = 'object'
        and jsonb_typeof(version.mode_config->'prologue') = 'object'
        and jsonb_typeof(version.mode_config->'beats') = 'array'
    ) and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      (count(*) between 2 and 20 and version.mode in ('flash', 'survival', 'narrative')
        or count(*) = 7 and version.mode = 'pyramid')
        and coalesce(bool_and(item.position between 1 and case when version.mode = 'pyramid' then 7 else 20 end), false)
        and coalesce(bool_and(item.points > 0), false)
        and coalesce(bool_and(item.config_schema_version = 1 and (
          version.mode = 'pyramid' and private.is_valid_pyramid_level_config(item.mode_config)
          or version.mode = 'narrative'
            and jsonb_typeof(item.mode_config) = 'object'
            and jsonb_typeof(item.mode_config->'questionSlug') = 'string'
          or version.mode not in ('pyramid', 'narrative') and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and count(*) filter (where private.is_supported_flash_question(question.id)) = count(*)
        and coalesce(sum(item.points), 0) = 100 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
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
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer v
    where r.slug = target_room_slug
      and sc.id = coalesce(target_publication_id, sc.id)
      and sc.status = 'closed'
      and cv.mode in ('flash', 'survival', 'narrative', 'pyramid')
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
    briefing_description   text
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
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    where cv.mode in ('flash', 'survival', 'narrative', 'pyramid')
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
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_calendar_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.status = 'active' and version.status in ('published', 'archived') and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_calendar_context (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status in ('published', 'archived')
        and version.mode in ('flash', 'survival', 'narrative', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;
