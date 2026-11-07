begin;

-- Read-only overlay for answer reviews. Gameplay and audit keep the original rows.
create view private.review_attempt_answers with (security_invoker = true) as
select answer.id, answer.attempt_id, answer.challenge_item_id, answer.answer,
  coalesce(regrade.after_status, answer.status) as status,
  coalesce(regrade.after_points, answer.points) as points,
  case when regrade.after_status is not null then regrade.after_details
    else answer.result_details end as result_details,
  answer.review_state, answer.presented_at, answer.submitted_at, answer.time_used_ms
from private.attempt_answers answer
left join lateral (
  select correction.after_status, correction.after_points, correction.after_details
  from private.attempt_answer_regrades correction
  where correction.attempt_id = answer.attempt_id
    and correction.challenge_item_id = answer.challenge_item_id
  order by correction.attempt_lock_version desc
  limit 1
) regrade on true;
alter view private.review_attempt_answers owner to postgres;
revoke all on private.review_attempt_answers from public, anon, authenticated, service_role;

-- The review total follows its per-answer breakdown. Global adjustments are tracked separately.
create function private.review_attempt_score(target_attempt uuid, original_score integer) returns integer
language sql stable set search_path = '' as $$
  select original_score + coalesce(sum(entry.amount), 0)::integer
  from private.flash_point_entries entry
  where entry.attempt_id = target_attempt and entry.entry_type = 'answer_regrade'
$$;
alter function private.review_attempt_score(uuid, integer) owner to postgres;
revoke all on function private.review_attempt_score(uuid, integer) from public, anon, authenticated, service_role;

create or replace function public.get_my_flash_result(target_attempt_id uuid)
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
  review_state            jsonb,
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
    a.id, a.scheduled_challenge_id, aa.challenge_item_id, i.position, q.id,
    q.type, q.payload_schema_version, q.public_payload, qs.solution_payload, aa.answer,
    aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, private.review_attempt_score(a.id, a.score), a.started_at, a.completed_at, a.lock_version,
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
  left join private.review_attempt_answers aa on aa.attempt_id = a.id and aa.challenge_item_id = i.id
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

create or replace function public.get_my_alphabet_result(target_attempt_id uuid)
returns table (
  attempt_id uuid,
  scheduled_challenge_id uuid,
  challenge_item_id uuid,
  item_position integer,
  question_version_id uuid,
  question_type text,
  payload_schema_version integer,
  public_payload jsonb,
  solution_payload jsonb,
  answer jsonb,
  answer_status text,
  points integer,
  result_details jsonb,
  presented_at timestamptz,
  submitted_at timestamptz,
  time_used_ms bigint,
  attempt_status text,
  attempt_score integer,
  attempt_started_at timestamptz,
  attempt_completed_at timestamptz,
  attempt_lock_version bigint,
  challenge_title text,
  challenge_subtitle text,
  challenge_description text,
  challenge_max_score integer,
  alphabet_letter text
)
language sql stable security definer set search_path = '' as $$
  select
    a.id, a.scheduled_challenge_id, i.id, i.position, q.id, q.type,
    q.payload_schema_version, q.public_payload, qs.solution_payload,
    aa.answer, aa.status, coalesce(aa.points, 0), aa.result_details,
    aa.presented_at, aa.submitted_at, coalesce(aa.time_used_ms, 0),
    a.status, coalesce(private.review_attempt_score(a.id, a.score), 0), a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score, i.mode_config->>'letter'
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.review_attempt_answers aa
    on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed'
    and cv.mode = 'alphabet' and r.status = 'active'
    and m.player_id = private.current_player_id() and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$$;

create or replace function public.get_my_pyramid_result(target_attempt_id uuid)
returns table (
  attempt_id uuid,
  scheduled_challenge_id uuid,
  challenge_item_id uuid,
  item_position integer,
  question_version_id uuid,
  question_type text,
  payload_schema_version integer,
  public_payload jsonb,
  solution_payload jsonb,
  answer jsonb,
  answer_status text,
  points integer,
  result_details jsonb,
  review_state jsonb,
  presented_at timestamptz,
  submitted_at timestamptz,
  time_used_ms bigint,
  attempt_status text,
  attempt_score integer,
  attempt_outcome text,
  attempt_started_at timestamptz,
  attempt_completed_at timestamptz,
  attempt_lock_version bigint,
  challenge_title text,
  challenge_subtitle text,
  challenge_description text,
  challenge_max_score integer
)
language sql stable security definer set search_path = '' as $$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.review_state, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, private.review_attempt_score(attempt.id, attempt.score), attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.review_attempt_answers answer on answer.attempt_id = attempt.id
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
$$;

create or replace function public.get_my_survival_result(target_attempt_id uuid)
returns table (
  attempt_id uuid,
  scheduled_challenge_id uuid,
  challenge_item_id uuid,
  item_position integer,
  question_version_id uuid,
  question_type text,
  payload_schema_version integer,
  public_payload jsonb,
  solution_payload jsonb,
  answer jsonb,
  answer_status text,
  points integer,
  result_details jsonb,
  review_state jsonb,
  presented_at timestamptz,
  submitted_at timestamptz,
  time_used_ms bigint,
  attempt_status text,
  attempt_score integer,
  attempt_outcome text,
  attempt_started_at timestamptz,
  attempt_completed_at timestamptz,
  attempt_lock_version bigint,
  challenge_title text,
  challenge_subtitle text,
  challenge_description text,
  challenge_max_score integer
)
language sql stable security definer set search_path = '' as $$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, question.id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.review_state, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, private.review_attempt_score(attempt.id, attempt.score), attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.review_attempt_answers answer on answer.attempt_id = attempt.id
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
$$;

create or replace function public.get_my_narrative_result(target_attempt_id uuid)
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
    attempt.id,
    attempt.scheduled_challenge_id,
    item.id,
    item.position,
    question.id,
    question.type,
    question.payload_schema_version,
    question.public_payload,
    solution.solution_payload,
    answer.answer,
    answer.status,
    coalesce(answer.points, 0),
    answer.result_details,
    answer.presented_at,
    answer.submitted_at,
    coalesce(answer.time_used_ms, 0),
    attempt.status,
    private.review_attempt_score(attempt.id, attempt.score),
    attempt.started_at,
    attempt.completed_at,
    attempt.lock_version,
    version.title,
    version.subtitle,
    version.description,
    version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_items item on item.challenge_version_id = version.id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  left join private.review_attempt_answers answer
    on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive'
    and attempt.status = 'completed'
    and version.mode = 'narrative'
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and membership.role in ('owner', 'admin', 'member')
  order by item.position
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
  review_state            jsonb,
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
      case when cv.mode in ('alphabet','time-trial') then cv.global_time_limit_ms end as global_time_limit_ms,
      (select count(*)::bigint from private.challenge_items item
        where item.challenge_version_id = cv.id) as question_count,
      case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end as initial_lives,
      a.id as attempt_id,
      a.status as attempt_status,
      private.review_attempt_score(a.id, a.score) as attempt_score,
      a.outcome as attempt_outcome,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      (extract(epoch from (coalesce(a.completed_at, a.started_at) - case when cv.mode = 'time-trial' and a.deadline_at is not null then a.deadline_at - cv.global_time_limit_ms * interval '1 millisecond' else a.started_at end)) * 1000)::bigint
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
    where cv.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
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
    case when a.challenge_mode in ('pyramid','time-trial') and aa.id is null then null else q.public_payload end,
    case when a.challenge_mode in ('pyramid','time-trial') and aa.id is null then null else qs.solution_payload end,
    aa.answer, aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at,
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
  left join private.review_attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  where a.challenge_mode <> 'survival' or aa.id is not null
  order by i.position
$$;

create or replace function private.read_completed_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scheduledChallengeId', sc.id, 'result',
    jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
      'status', a.status, 'score', private.review_attempt_score(a.id, a.score), 'outcome', a.outcome,
      'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end,
      'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case when answer.status in ('incorrect','unanswered','timeout') then 1
          when q.type = 'queens' and coalesce((answer.result_details->>'incorrectAttempts')::integer,0) > 0 then 1 else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions q on q.id = item.question_version_id where answer.attempt_id = a.id
      ),0),0) end,
      'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', answer.challenge_item_id,
        'answer', answer.answer, 'status', answer.status, 'points', answer.points,
        'timeUsedMs', answer.time_used_ms, 'resultDetails', answer.result_details,
        'reviewState', answer.review_state) order by item.position)
        from private.review_attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id), '[]'::jsonb))) ||
      jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome, 'terminalReason', a.terminal_reason,
        'timeTrial', case when cv.mode = 'time-trial' then private.time_trial_progress(a.id) end))
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled'
    and room.status = 'active' and m.status = 'active' and m.role in ('owner','admin','member')
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;

commit;
