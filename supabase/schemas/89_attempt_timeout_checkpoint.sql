set local check_function_bodies = off;

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
