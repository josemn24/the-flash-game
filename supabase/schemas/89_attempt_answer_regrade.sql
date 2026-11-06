set local check_function_bodies = off;

create function private.valid_regrade_accepted_answers(answers jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(answers) = 'array' then
    jsonb_array_length(answers) > 0 and not exists (
      select 1 from jsonb_array_elements(answers) accepted(value)
      where jsonb_typeof(accepted.value) <> 'string' or (accepted.value #>> '{}') !~ '[^[:space:]]'
    )
  else false end
$$;
alter function private.valid_regrade_accepted_answers(jsonb) owner to postgres;
revoke all on function private.valid_regrade_accepted_answers(jsonb) from public, anon, authenticated, service_role;

create function private.read_attempt_answer_regrade_context(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := private.current_player_id();
  target_attempt public.attempts%rowtype;
  target_item private.challenge_items%rowtype;
  target_question private.question_versions%rowtype;
  target_answer private.attempt_answers%rowtype;
  target_schedule public.scheduled_challenges%rowtype;
  rubric private.question_versions%rowtype;
  rubric_solution jsonb;
  current_status text;
  current_points integer;
  current_rubric uuid;
  total_points integer;
  clues_revealed integer;
  clues_available integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['attemptId','challengeItemId','rubricQuestionVersionId','lockVersion']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'attemptId','challengeItemId','rubricQuestionVersionId','lockVersion'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into target_attempt from public.attempts a
  where a.id = (input->>'attemptId')::uuid;
  if not found or target_attempt.kind <> 'competitive' then
    raise exception 'not_competitive' using errcode = '55000';
  end if;
  if target_attempt.status <> 'completed' then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;
  if target_attempt.lock_version <> (input->>'lockVersion')::bigint then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into target_schedule from public.scheduled_challenges sc
  where sc.id = target_attempt.scheduled_challenge_id;
  if not found or target_schedule.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = '55000';
  end if;

  select * into target_item from private.challenge_items item
  where item.id = (input->>'challengeItemId')::uuid
    and item.challenge_version_id = target_attempt.challenge_version_id;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select * into target_question from private.question_versions question
  where question.id = target_item.question_version_id;
  select * into target_answer from private.attempt_answers answer
  where answer.attempt_id = target_attempt.id and answer.challenge_item_id = target_item.id;
  if not found or target_answer.status not in ('correct','partial','incorrect')
    or target_answer.submitted_at is null or target_answer.answer is null
    or jsonb_typeof(target_answer.answer) <> 'string'
    or (target_answer.answer #>> '{}') !~ '[^[:space:]]'
    or target_question.type not in ('short-text','progressive-image','progressive-clues') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into rubric from private.question_versions question
  where question.id = (input->>'rubricQuestionVersionId')::uuid;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select solution.solution_payload into rubric_solution
  from private.question_version_solutions solution
  where solution.question_version_id = rubric.id;
  if not found or rubric.status <> 'published'
    or rubric.question_definition_id <> target_question.question_definition_id
    or rubric.type <> target_question.type then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if not private.valid_regrade_accepted_answers(rubric_solution->'acceptedAnswers') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select correction.after_status, correction.after_points, correction.rubric_question_version_id
    into current_status, current_points, current_rubric
  from private.attempt_answer_regrades correction
  where correction.attempt_id = target_attempt.id and correction.challenge_item_id = target_item.id
  order by correction.attempt_lock_version desc limit 1;
  if not found then
    current_status := target_answer.status;
    current_points := target_answer.points;
    current_rubric := null;
  end if;
  select coalesce(sum(entry.amount), 0)::integer into total_points
  from private.flash_point_entries entry where entry.attempt_id = target_attempt.id;

  if target_question.type = 'progressive-clues' then
    select coalesce(max(event.clue_index), 1)::integer into clues_revealed
    from private.progressive_clue_reveal_events event
    where event.attempt_id = target_attempt.id and event.challenge_item_id = target_item.id;
    select event.available_points into clues_available
    from private.progressive_clue_reveal_events event
    where event.attempt_id = target_attempt.id and event.challenge_item_id = target_item.id
    order by event.clue_index desc limit 1;
    clues_available := coalesce(clues_available, target_item.points);
  end if;

  select jsonb_build_object(
    'receiptId', target_answer.receipt_id,
    'attemptId', target_attempt.id,
    'challengeItemId', target_item.id,
    'rubricQuestionVersionId', rubric.id,
    'expectedLockVersion', target_attempt.lock_version,
    'originalStatus', target_answer.status,
    'originalPoints', target_answer.points,
    'currentStatus', current_status,
    'currentPoints', current_points,
    'currentRubricVersionId', current_rubric,
    'effectiveScore', total_points,
    'rubricVersionNumber', rubric.version_number,
    'questionVersionId', target_question.id,
    'questionType', target_question.type,
    'payloadSchemaVersion', target_question.payload_schema_version,
    'publicPayload', target_question.public_payload,
    'solutionPayload', original_solution.solution_payload,
    'timeLimitMs', target_question.time_limit_ms,
    'itemPoints', target_item.points,
    'itemConfigSchemaVersion', target_item.config_schema_version,
    'itemConfig', target_item.mode_config,
    'mode', challenge.mode,
    'modeConfigSchemaVersion', challenge.config_schema_version,
    'modeConfig', challenge.mode_config,
    'answer', target_answer.answer,
    'receivedAt', target_answer.submitted_at,
    'timeUsedMs', target_answer.time_used_ms,
    'timedOut', false,
    'acceptedAnswers', rubric_solution->'acceptedAnswers',
    'progressiveCluesRevealed', clues_revealed,
    'progressiveClueAvailablePoints', clues_available
  ) into result
  from private.question_version_solutions original_solution
  join private.challenge_versions challenge on challenge.id = target_attempt.challenge_version_id
  where original_solution.question_version_id = target_question.id;
  return result;
end;
$$;
alter function private.read_attempt_answer_regrade_context(jsonb) owner to postgres;
revoke all on function private.read_attempt_answer_regrade_context(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.read_attempt_answer_regrade_context(jsonb) to service_role;

-- Hold the same command-key lock through evaluation and the final write. A retry
-- can use the stored result even when the attempt has since advanced.
create function private.prepare_attempt_answer_regrade(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  required text[] := array['attemptId','challengeItemId','rubricQuestionVersionId','lockVersion','reason','idempotencyKey'];
  cached private.command_requests%rowtype;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object' or nullif(btrim(key), '') is null
    or not input ?& required
    or exists (select 1 from jsonb_object_keys(input) k where not k = any(required))
    or exists (select 1 from unnest(required) k where input->k = 'null'::jsonb) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found then
    if cached.operation <> 'regrade_answer'
      or (cached.input - array['resultStatus','resultPoints','resultDetails']) <> input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('result', cached.result);
  end if;
  return jsonb_build_object('context', private.read_attempt_answer_regrade_context(
    input - array['reason','idempotencyKey']
  ));
end;
$$;
alter function private.prepare_attempt_answer_regrade(jsonb) owner to postgres;
revoke all on function private.prepare_attempt_answer_regrade(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_attempt_answer_regrade(jsonb) to service_role;

create function private.handle_attempt_answer_regrade_command(
  input jsonb,
  actor uuid,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  instant timestamptz,
  key text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  target_item private.challenge_items%rowtype;
  original_question private.question_versions%rowtype;
  rubric private.question_versions%rowtype;
  original_answer private.attempt_answers%rowtype;
  current_status text;
  current_points integer;
  current_details jsonb;
  proposed_status text := input->>'resultStatus';
  proposed_points integer := (input->>'resultPoints')::integer;
  difference integer;
  balance integer;
  next_balance integer;
  rubric_solution jsonb;
  result jsonb;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_attempt.status <> 'completed' then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;
  if target_schedule.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = '55000';
  end if;
  if nullif(btrim(input->>'reason'), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if target_attempt.kind <> 'competitive' then
    raise exception 'not_competitive' using errcode = '55000';
  end if;
  if proposed_status not in ('correct','partial','incorrect')
    or proposed_points < 0 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into target_item from private.challenge_items item
  where item.id = (input->>'challengeItemId')::uuid
    and item.challenge_version_id = target_attempt.challenge_version_id;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select * into original_question from private.question_versions question
  where question.id = target_item.question_version_id;
  if original_question.type not in ('short-text','progressive-image','progressive-clues') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  select * into original_answer from private.attempt_answers answer
  where answer.attempt_id = target_attempt.id and answer.challenge_item_id = target_item.id;
  if not found or original_answer.status not in ('correct','partial','incorrect')
    or original_answer.submitted_at is null or original_answer.answer is null
    or jsonb_typeof(original_answer.answer) <> 'string'
    or (original_answer.answer #>> '{}') !~ '[^[:space:]]' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into rubric from private.question_versions question
  where question.id = (input->>'rubricQuestionVersionId')::uuid;
  if not found or rubric.status <> 'published'
    or rubric.question_definition_id <> original_question.question_definition_id
    or rubric.type <> original_question.type then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  select solution.solution_payload into rubric_solution
  from private.question_version_solutions solution where solution.question_version_id = rubric.id;
  if not private.valid_regrade_accepted_answers(rubric_solution->'acceptedAnswers') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if proposed_points > target_item.points then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  select correction.after_status, correction.after_points, correction.after_details
    into current_status, current_points, current_details
  from private.attempt_answer_regrades correction
  where correction.attempt_id = target_attempt.id and correction.challenge_item_id = target_item.id
  order by correction.attempt_lock_version desc limit 1;
  if not found then
    current_status := original_answer.status;
    current_points := original_answer.points;
    current_details := original_answer.result_details;
  end if;

  select coalesce(sum(entry.amount), 0)::integer into balance
  from private.flash_point_entries entry where entry.attempt_id = target_attempt.id;
  difference := proposed_points - current_points;
  next_balance := balance + difference;
  if next_balance not between 0 and 100 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  insert into private.attempt_answer_regrades (
    attempt_id, challenge_item_id, rubric_question_version_id, attempt_lock_version,
    before_status, before_points, before_details, after_status, after_points,
    after_details, reason, actor_player_id, idempotency_key
  ) values (
    target_attempt.id, target_item.id, rubric.id, target_attempt.lock_version,
    current_status, current_points, current_details, proposed_status, proposed_points,
    input->'resultDetails', input->>'reason', actor, 'regrade:' || actor::text || ':' || key
  );
  insert into private.flash_point_entries (
    season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
    amount, reason, created_by_player_id, idempotency_key
  ) values (
    target_schedule.season_id, target_attempt.player_id, target_schedule.id, target_attempt.id,
    'answer_regrade', difference, input->>'reason', actor, 'regrade:' || actor::text || ':' || key
  );
  update public.attempts set lock_version = lock_version + 1
  where id = target_attempt.id returning * into target_attempt;

  result := jsonb_build_object(
    'status', target_attempt.status,
    'effectiveScore', next_balance,
    'challengeItemId', target_item.id,
    'rubricQuestionVersionId', rubric.id,
    'beforeStatus', current_status,
    'beforePoints', current_points,
    'afterStatus', proposed_status,
    'afterPoints', proposed_points,
    'difference', difference,
    'lockVersion', target_attempt.lock_version
  );
  return result;
end;
$$;
alter function private.handle_attempt_answer_regrade_command(jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) owner to postgres;
revoke all on function private.handle_attempt_answer_regrade_command(jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) from public, anon, authenticated, service_role;
