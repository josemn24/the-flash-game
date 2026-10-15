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
    a.id, a.scheduled_challenge_id, aa.challenge_item_id, i.position, q.id,
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

CREATE OR REPLACE FUNCTION public.get_my_survival_result (
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
    attempt_outcome        text,
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
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and version.mode = 'survival' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_pyramid_result (
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
    attempt_outcome        text,
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
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and attempt.outcome in ('summit', 'failed')
    and version.mode = 'pyramid' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

ALTER FUNCTION public.get_my_flash_result(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_my_survival_result(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_my_pyramid_result(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_my_flash_result(uuid) FROM public, anon, service_role;
REVOKE ALL ON FUNCTION public.get_my_survival_result(uuid) FROM public, anon, service_role;
REVOKE ALL ON FUNCTION public.get_my_pyramid_result(uuid) FROM public, anon, service_role;

GRANT EXECUTE ON FUNCTION public.get_my_flash_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_survival_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_pyramid_result(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
