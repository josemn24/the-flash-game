-- S14 — Survival projections. Question payloads remain behind prepare_interaction;
-- solutions are released only for the owner's completed result.

create function public.get_my_survival_challenge(target_room_slug text, target_publication_id uuid)
returns table (
  room_id uuid,
  room_slug text,
  room_title text,
  publication_id uuid,
  publication_status text,
  publication_opens_at timestamptz,
  publication_closes_at timestamptz,
  challenge_id uuid,
  challenge_slug text,
  challenge_version_id uuid,
  challenge_title text,
  challenge_subtitle text,
  challenge_description text,
  challenge_mode text,
  challenge_max_score integer,
  initial_lives integer,
  question_count bigint,
  own_attempt_id uuid,
  own_attempt_status text,
  own_attempt_score integer,
  own_attempt_started_at timestamptz,
  own_attempt_completed_at timestamptz,
  own_attempt_deadline_at timestamptz,
  own_attempt_lock_version bigint,
  challenge_item_id uuid,
  item_position integer,
  question_version_id uuid,
  question_type text,
  payload_schema_version integer,
  time_limit_ms integer,
  item_points integer
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.title as challenge_title,
      version.subtitle as challenge_subtitle, version.description as challenge_description,
      version.mode as challenge_mode, version.max_score as challenge_max_score,
      (version.mode_config->>'lives')::integer as initial_lives,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status = 'published' and version.mode = 'survival'
      and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
      and jsonb_typeof(version.mode_config->'lives') = 'number'
      and (version.mode_config->>'lives')::integer between 1 and 20
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_title, publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score, publication.initial_lives,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, question.id, question.type, question.payload_schema_version,
    question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
$$;

create function public.get_my_survival_result(target_attempt_id uuid)
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
    item.position, answer.challenge_version_id, question.type, question.payload_schema_version,
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
$$;

alter function public.get_my_survival_challenge(text, uuid) owner to postgres;
alter function public.get_my_survival_result(uuid) owner to postgres;
revoke all on function public.get_my_survival_challenge(text, uuid), public.get_my_survival_result(uuid)
  from public, anon, service_role;
grant execute on function public.get_my_survival_challenge(text, uuid), public.get_my_survival_result(uuid)
  to authenticated;
