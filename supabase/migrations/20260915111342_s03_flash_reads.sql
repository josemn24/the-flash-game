SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_my_flash_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    public_payload           jsonb,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    join public.seasons s on s.room_id = r.id and s.status = 'active'
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
        (sc.status = 'open' and sc.opens_at <= statement_timestamp()
          and statement_timestamp() < sc.closes_at)
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
    i.id, i.position, q.id, q.type, q.payload_schema_version, q.public_payload,
    q.time_limit_ms, i.points
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_flash_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_flash_challenge"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_flash_challenge"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_flash_result"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_flash_result"(uuid) TO "authenticated", "postgres";
