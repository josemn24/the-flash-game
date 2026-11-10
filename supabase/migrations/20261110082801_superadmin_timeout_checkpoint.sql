-- Recognize a solved checkpoint on a completed time trial without rewriting its receipt or accreditation.

set local check_function_bodies = off;

alter table private.attempt_answer_regrades
  drop constraint attempt_answer_regrades_before_status_check,
  add constraint attempt_answer_regrades_before_status_check
    check (before_status in ('correct', 'partial', 'incorrect', 'unanswered'));

create or replace view private.review_attempt_answers with (security_invoker = true) as
select answer.id, answer.attempt_id, answer.challenge_item_id, answer.answer,
  coalesce(regrade.after_status, answer.status) as status,
  coalesce(regrade.after_points, answer.points) as points,
  case when regrade.after_status is not null then regrade.after_details
    else answer.result_details end as result_details,
  answer.review_state, answer.presented_at, answer.submitted_at, answer.time_used_ms, answer.receipt_id
from private.attempt_answers answer
left join lateral (
  select correction.after_status, correction.after_points, correction.after_details
  from private.attempt_answer_regrades correction
  where correction.attempt_id = answer.attempt_id
    and correction.challenge_item_id = answer.challenge_item_id
  order by correction.attempt_lock_version desc
  limit 1
) regrade on true;

create or replace function private.time_trial_progress(target_attempt uuid) returns jsonb
language sql volatile set search_path = '' as $$
  with facts as (
    select a.*, cv.global_time_limit_ms,
      (select count(*)::integer from private.challenge_items i where i.challenge_version_id = a.challenge_version_id) as total,
      answers.*
    from public.attempts a join private.challenge_versions cv on cv.id = a.challenge_version_id
    cross join lateral (
      select count(*) filter (where aa.status = 'correct')::integer as solved,
        max(r.effective_submitted_at) filter (where aa.status = 'correct'
          and ((not r.timed_out and r.received_at < a.deadline_at)
            or (r.timed_out and r.effective_submitted_at = a.deadline_at))) as last_correct,
        coalesce(sum(aa.points),0)::integer as earned,
        max(aa.submitted_at) as last_submitted,
        coalesce(bool_or(aa.status = 'incorrect'),false) as has_incorrect,
        coalesce(bool_or(aa.status <> 'correct'),false) as has_unresolved
      from private.review_attempt_answers aa
      join private.answer_receipts r on r.id = aa.receipt_id
      where aa.attempt_id = a.id
    ) answers
    where a.id = target_attempt and cv.mode = 'time-trial'
  )
  select jsonb_build_object(
    'kind','time-trial','currentIndex', least(solved,total - 1),
    'solvedCount',solved,'totalCount',total,'points',earned,
    'clockStartedAt',deadline_at - global_time_limit_ms * interval '1 millisecond',
    'deadlineAt',deadline_at,'serverNow',clock_timestamp(),
    'elapsedTimeMs',case when deadline_at is null then 0 else greatest(0,floor(extract(epoch from (
      (case when solved = total then last_correct
        when status = 'completed' and has_incorrect then last_submitted
        else least(coalesce(completed_at,clock_timestamp()),deadline_at) end)
      - (deadline_at - global_time_limit_ms * interval '1 millisecond')))*1000))::bigint end,
    'lastCorrectElapsedMs',floor(extract(epoch from (last_correct - (deadline_at - global_time_limit_ms * interval '1 millisecond'))) * 1000)::bigint,
    'endReason',case
      when status = 'completed' and terminal_reason = 'time_limit' and solved = total then 'all_solved'
      when terminal_reason in ('all_solved','validation_limit','time_limit','recovery_interrupted') then terminal_reason
      when solved = total then 'all_solved'
      when has_incorrect then 'validation_limit'
      when deadline_at is not null and clock_timestamp() >= deadline_at then 'time_limit'
      when has_unresolved then 'recovery_interrupted'
      else null end
  ) from facts
$$;

create or replace function public.get_my_time_trial_challenge(target_room_slug text, target_publication_id uuid)
returns table (
  room_id                 uuid,
  room_slug               text,
  room_title              text,
  publication_id          uuid,
  publication_status      text,
  publication_opens_at    timestamptz,
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
  own_attempt_id          uuid,
  own_attempt_status      text,
  own_attempt_score       integer,
  own_attempt_started_at  timestamptz,
  own_attempt_completed_at timestamptz,
  own_attempt_deadline_at timestamptz,
  own_attempt_lock_version bigint,
  challenge_item_id       uuid,
  item_position           integer,
  question_version_id     uuid,
  question_type           text,
  payload_schema_version  integer,
  time_limit_ms           integer,
  item_points             integer,
  global_time_limit_ms     integer
)
language sql stable security definer set search_path = '' as $$
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
      private.review_attempt_score(a.id, a.score) as own_attempt_score,
      a.started_at as own_attempt_started_at,
      a.completed_at as own_attempt_completed_at,
      a.deadline_at as own_attempt_deadline_at,
      a.lock_version as own_attempt_lock_version,
      cv.global_time_limit_ms,
      cv.id as version_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
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
        private.publication_is_effectively_open(
          sc.status, s.status, s.starts_at, s.ends_at,
          sc.opens_at, sc.closes_at, statement_timestamp()
        )
        or a.id is not null
      )
      and cv.status in ('published', 'archived')
      and cv.mode = 'time-trial'
  )
  select
    p.room_id, p.room_slug, p.room_title, p.publication_id, p.publication_status,
    p.publication_opens_at, p.publication_closes_at, p.challenge_id, p.challenge_slug,
    p.challenge_version_id, p.challenge_title, p.challenge_subtitle, p.challenge_description,
    p.challenge_mode, p.challenge_max_score,
    count(i.id) over (partition by p.challenge_version_id),
    p.own_attempt_id, p.own_attempt_status, p.own_attempt_score, p.own_attempt_started_at,
    p.own_attempt_completed_at, p.own_attempt_deadline_at, p.own_attempt_lock_version,
    i.id, i.position, q.id, q.type, q.payload_schema_version,
    q.time_limit_ms, i.points, p.global_time_limit_ms
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$$;

create or replace function public.get_my_time_trial_result(target_attempt_id uuid)
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
  challenge_max_score     integer,
  time_trial              jsonb
)
language sql stable security definer set search_path = '' as $$
  select
    a.id, a.scheduled_challenge_id, i.id, i.position, q.id,
    q.type, q.payload_schema_version, case when aa.id is not null then q.public_payload end, case when aa.id is not null then qs.solution_payload end, aa.answer,
    aa.status, aa.points, aa.result_details, aa.review_state, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, private.review_attempt_score(a.id, a.score), a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score, private.time_trial_progress(a.id)
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
    and cv.mode = 'time-trial'
    and r.status = 'active'
    and m.player_id = private.current_player_id()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
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
      jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome,
        'terminalReason', coalesce(trial.progress->>'endReason', a.terminal_reason),
        'timeTrial', trial.progress))
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  cross join lateral (select case when cv.mode = 'time-trial' then private.time_trial_progress(a.id) end as progress) trial
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled'
    and room.status = 'active' and m.status = 'active' and m.role in ('owner','admin','member')
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;

create function private.is_solved_timeout_checkpoint(
  answer private.attempt_answers, deadline timestamptz
) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((
    select case question.type
      when 'queens' then answer.review_state->>'type' = 'queens'
        and (select jsonb_agg(cell order by cell)
             from jsonb_array_elements(answer.review_state->'queens') cell)
          = (select jsonb_agg(cell order by cell)
             from jsonb_array_elements(solution.solution_payload->'solution') cell)
      when 'connect-pairs' then answer.review_state->>'type' = 'connect-pairs'
        and private.connect_pairs_answer_valid(
          question.public_payload, jsonb_build_object('paths', answer.review_state->'paths'))
      else false end
    from private.answer_receipts receipt
    join private.challenge_items item on item.id = receipt.challenge_item_id
    join private.question_versions question on question.id = item.question_version_id
    join private.question_version_solutions solution on solution.question_version_id = question.id
    where receipt.id = answer.receipt_id and receipt.timed_out
      and receipt.effective_submitted_at = deadline
      and (receipt.answer is null or receipt.answer = 'null'::jsonb)
      and answer.status in ('partial', 'unanswered')
      and answer.points < item.points
      and answer.review_state is not null
  ), false)
$$;

create function private.preview_timeout_checkpoint(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  attempt record;
  answer private.attempt_answers%rowtype;
  board_points integer;
  balance integer;
  difference integer;
  progress jsonb;
begin
  if not exists (select 1 from private.platform_role_assignments
    where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select a.*, room.slug as room_slug into attempt
  from public.attempts a
  join public.scheduled_challenges schedule on schedule.id = a.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = a.challenge_version_id
  where a.id = (input->>'attemptId')::uuid
    and schedule.id = (input->>'scheduledChallengeId')::uuid
    and room.id = (input->>'roomId')::uuid and room.status = 'active'
    and schedule.status <> 'cancelled' and version.mode = 'time-trial';
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if attempt.lock_version is distinct from (input->>'lockVersion')::bigint then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if attempt.kind <> 'competitive' or attempt.status <> 'completed'
    or attempt.terminal_reason is distinct from 'time_limit' then
    raise exception 'timeout_checkpoint_unavailable' using errcode = '55000';
  end if;
  select * into answer from private.attempt_answers
  where attempt_id = attempt.id and challenge_item_id = (input->>'challengeItemId')::uuid;
  if not found or not private.is_solved_timeout_checkpoint(answer, attempt.deadline_at)
    or exists (select 1 from private.attempt_answer_regrades correction
      where correction.attempt_id = attempt.id and correction.challenge_item_id = answer.challenge_item_id) then
    raise exception 'timeout_checkpoint_unavailable' using errcode = '55000';
  end if;
  select points into board_points from private.challenge_items where id = answer.challenge_item_id;
  select sum(entry.amount)::integer into balance
  from private.flash_point_entries entry
  where entry.attempt_id = attempt.id
  having bool_or(entry.entry_type = 'accreditation') and not bool_or(entry.entry_type = 'adjustment');
  difference := board_points - answer.points;
  if balance is null or balance + difference > 100 then
    raise exception 'timeout_checkpoint_unavailable' using errcode = '55000';
  end if;
  progress := private.time_trial_progress(attempt.id);
  return jsonb_build_object(
    'attemptId', attempt.id, 'challengeItemId', answer.challenge_item_id, 'roomSlug', attempt.room_slug,
    'lockVersion', attempt.lock_version, 'currentPoints', answer.points, 'proposedPoints', board_points,
    'currentEffectiveScore', balance, 'newEffectiveScore', balance + difference, 'difference', difference,
    'solvedCount', progress->'solvedCount', 'totalCount', progress->'totalCount',
    'lastCorrectElapsedMs', progress->'lastCorrectElapsedMs',
    'deadlineElapsedMs', (select global_time_limit_ms from private.challenge_versions where id = attempt.challenge_version_id)
  );
end;
$$;

create function private.recognize_timeout_checkpoint(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  command_key text := input->>'idempotencyKey';
  reason text := btrim(input->>'reason');
  entry_key text := 'checkpoint:' || actor || ':' || command_key;
  cached private.command_requests%rowtype;
  attempt public.attempts%rowtype;
  schedule public.scheduled_challenges%rowtype;
  preview jsonb;
  result jsonb;
begin
  if not exists (select 1 from private.platform_role_assignments
    where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or coalesce(length(command_key), 0) not between 8 and 160 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if not input ?& array['roomId', 'scheduledChallengeId', 'attemptId', 'challengeItemId',
    'lockVersion', 'reason', 'idempotencyKey'] or (select count(*) from jsonb_object_keys(input)) <> 7 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if coalesce(length(reason), 0) not between 1 and 500 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  perform private.lock_command_key(actor, command_key);
  select * into cached from private.command_requests
  where actor_id = actor and idempotency_key = command_key;
  if found then
    if cached.operation <> 'recognize_timeout_checkpoint' or cached.input <> input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into attempt from public.attempts where id = (input->>'attemptId')::uuid for update;
  select * into schedule from public.scheduled_challenges
  where id = attempt.scheduled_challenge_id for share;
  preview := private.preview_timeout_checkpoint(input);

  insert into private.attempt_answer_regrades (
    attempt_id, challenge_item_id, rubric_question_version_id, attempt_lock_version,
    before_status, before_points, before_details, after_status, after_points, reason, actor_player_id, idempotency_key
  )
  select attempt.id, answer.challenge_item_id, item.question_version_id, attempt.lock_version,
    answer.status, answer.points, answer.result_details, 'correct', item.points, reason, actor, entry_key
  from private.attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
  where answer.attempt_id = attempt.id and answer.challenge_item_id = (input->>'challengeItemId')::uuid;
  insert into private.flash_point_entries (
    season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount,
    reason, created_by_player_id, idempotency_key
  ) values (schedule.season_id, attempt.player_id, schedule.id, attempt.id, 'answer_regrade',
    (preview->>'difference')::integer, reason, actor, entry_key);
  update public.attempts set lock_version = lock_version + 1 where id = attempt.id returning * into attempt;

  result := jsonb_build_object(
    'attemptId', attempt.id, 'challengeItemId', preview->'challengeItemId', 'roomSlug', preview->'roomSlug',
    'lockVersion', attempt.lock_version, 'status', attempt.status, 'effectiveScore', preview->'newEffectiveScore',
    'boardPoints', preview->'proposedPoints', 'seasonPointsDelta', preview->'difference',
    'timeTrial', private.time_trial_progress(attempt.id)
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, 'recognize_timeout_checkpoint', 'attempt', attempt.id, reason, command_key, preview, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values(actor, command_key, 'recognize_timeout_checkpoint', input, result);
  return result;
end;
$$;

alter function private.is_solved_timeout_checkpoint(private.attempt_answers,timestamptz) owner to postgres;
alter function private.preview_timeout_checkpoint(jsonb) owner to postgres;
alter function private.recognize_timeout_checkpoint(jsonb) owner to postgres;
revoke all on function private.is_solved_timeout_checkpoint(private.attempt_answers,timestamptz),
  private.preview_timeout_checkpoint(jsonb), private.recognize_timeout_checkpoint(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.preview_timeout_checkpoint(jsonb), private.recognize_timeout_checkpoint(jsonb) to service_role;

create or replace function public.get_superadmin_attempt_inspection(
  target_room_id uuid,
  target_scheduled_challenge_id uuid,
  target_attempt_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  inspection_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'publication', jsonb_build_object(
      'scheduledChallengeId', schedule.id,
      'roomId', room.id,
      'roomTitle', room.title,
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
    ),
    'attempt', jsonb_build_object(
      'attemptId', attempt.id,
      'playerId', attempt.player_id,
      'displayName', player.display_name,
      'avatarPath', player.avatar_path,
      'email', auth_user.email,
      'status', attempt.status,
      'outcome', attempt.outcome,
      'attemptNumber', attempt.attempt_number,
      'startedAt', attempt.started_at,
      'deadlineAt', attempt.deadline_at,
      'completedAt', attempt.completed_at,
      'originalScore', attempt.score,
      'effectiveScore', coalesce((select sum(entry.amount)::integer
        from private.flash_point_entries entry where entry.attempt_id = attempt.id), 0),
      'lockVersion', attempt.lock_version,
      'isCorrected', exists (select 1 from private.flash_point_entries entry
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'answer_regrade', 'reversal')),
      'terminalReason', attempt.terminal_reason,
      'effectiveTerminalReason', case when version.mode = 'time-trial' and attempt.status = 'completed'
        then private.time_trial_progress(attempt.id)->>'endReason' else attempt.terminal_reason end
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'challengeItemId', item.id,
        'position', item.position,
        'itemPoints', item.points,
        'questionVersionId', question.id,
        'questionType', question.type,
        'publicPayload', question.public_payload,
        'answer', answer.answer,
        'status', answer.status,
        'effectiveStatus', coalesce(regrade.after_status, answer.status),
        'resultDetails', answer.result_details,
        'awardedPoints', answer.points,
        'effectiveAwardedPoints', coalesce(regrade.after_points, answer.points),
        'canRecognizeTimeoutCheckpoint', case when version.mode = 'time-trial'
          and attempt.kind = 'competitive' and attempt.status = 'completed'
          and attempt.terminal_reason = 'time_limit' and schedule.status <> 'cancelled'
          and regrade.after_status is null and answer.status in ('partial','unanswered')
          and not exists (select 1 from private.flash_point_entries entry
            where entry.attempt_id = attempt.id and entry.entry_type = 'adjustment')
          then private.is_solved_timeout_checkpoint(answer.*, attempt.deadline_at)
          else false end,
        'currentRubricVersionId', regrade.rubric_question_version_id,
        'availableRubrics', case when attempt.kind = 'competitive' and attempt.status = 'completed'
          and schedule.status <> 'cancelled' and question.type in ('short-text','progressive-image','progressive-clues')
          and answer.status in ('correct','partial','incorrect') and answer.submitted_at is not null
          and jsonb_typeof(answer.answer) = 'string' and (answer.answer #>> '{}') ~ '[^[:space:]]' then coalesce((
            select jsonb_agg(jsonb_build_object('questionVersionId', rubric.id, 'versionNumber', rubric.version_number)
              order by rubric.version_number desc)
            from private.question_versions rubric
            join private.question_version_solutions solution on solution.question_version_id = rubric.id
            where rubric.question_definition_id = question.question_definition_id
              and rubric.type = question.type and rubric.status = 'published'
              and private.valid_regrade_accepted_answers(solution.solution_payload->'acceptedAnswers')
          ), '[]'::jsonb) else '[]'::jsonb end,
        'presentedAt', answer.presented_at,
        'submittedAt', answer.submitted_at,
        'timeUsedMs', answer.time_used_ms
      ) order by item.position)
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      left join private.attempt_answers answer
        on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
      left join lateral (
        select correction.after_status, correction.after_points, correction.rubric_question_version_id
        from private.attempt_answer_regrades correction
        where correction.attempt_id = attempt.id and correction.challenge_item_id = item.id
        order by correction.attempt_lock_version desc
        limit 1
      ) regrade on true
      where item.challenge_version_id = attempt.challenge_version_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', entry.id,
        'entryType', entry.entry_type,
        'amount', entry.amount,
        'reason', entry.reason,
        'createdByPlayerId', entry.created_by_player_id,
        'createdByDisplayName', creator.display_name,
        'createdAt', entry.created_at
      ) order by entry.created_at, entry.id)
      from private.flash_point_entries entry
      left join public.players creator on creator.id = entry.created_by_player_id
      where entry.attempt_id = attempt.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'auditId', audit.id,
        'action', audit.action,
        'entityType', audit.entity_type,
        'entityId', audit.entity_id,
        'reason', audit.reason,
        'requestId', audit.request_id,
        'actorPlayerId', audit.actor_player_id,
        'actorDisplayName', audit_actor.display_name,
        'beforePayload', coalesce(audit.before_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'afterPayload', coalesce(audit.after_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'createdAt', audit.created_at
      ) order by audit.created_at, audit.id)
      from private.audit_log audit
      left join public.players audit_actor on audit_actor.id = audit.actor_player_id
      where audit.entity_type = 'attempt' and audit.entity_id = attempt.id
    ), '[]'::jsonb)
  )
  into inspection_payload
  from public.attempts attempt
  join public.players player on player.id = attempt.player_id
  left join auth.users auth_user on auth_user.id = player.auth_user_id
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where attempt.id = target_attempt_id
    and attempt.scheduled_challenge_id = target_scheduled_challenge_id
    and attempt.kind = 'competitive'
    and room.id = target_room_id
    and room.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial');

  return inspection_payload;
end;
$$;
