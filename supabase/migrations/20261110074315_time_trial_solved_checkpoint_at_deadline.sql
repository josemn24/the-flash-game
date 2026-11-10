-- Credit complete Queens and Connect Pairs checkpoints at the global deadline.

create or replace function private.guard_answer() returns trigger
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype;
  r private.answer_receipts%rowtype;
  item_points integer;
  challenge_mode text;
  challenge_config jsonb;
  question_version uuid;
  public_payload jsonb;
  solution jsonb;
  checkpoint_solved boolean := false;
  correct_placements integer;
  required_placements integer;
  connected_pairs integer;
  total_pairs integer;
  covered_cells integer;
  total_cells integer;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.status is distinct from 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  select * into r from private.answer_receipts where id = new.receipt_id;
  if not found or (r.attempt_id, r.challenge_item_id, r.challenge_version_id) is distinct from
    (new.attempt_id, new.challenge_item_id, new.challenge_version_id) then
    raise exception 'A final answer requires its immutable receipt';
  end if;
  new.presented_at := r.presented_at;
  new.submitted_at := r.effective_submitted_at;
  new.time_used_ms := r.time_used_ms;
  new.answer := r.answer;
  -- Late timeout finalization uses the previously recorded reception, not evaluation time.
  if new.presented_at < a.started_at or new.presented_at > a.deadline_at
    or (new.submitted_at is not null and new.submitted_at > a.deadline_at) then
    raise exception 'Answer timestamps outside attempt deadline';
  end if;
  if exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
    raise exception 'Publication cancelled';
  end if;
  select i.points, cv.mode, cv.mode_config, i.question_version_id
    into item_points, challenge_mode, challenge_config, question_version
  from private.challenge_items i
  join private.challenge_versions cv on cv.id = i.challenge_version_id
  where i.id = new.challenge_item_id;
  if challenge_mode = 'time-trial'
    and (new.status = 'partial' or new.points <> case when new.status = 'correct' then item_points else 0 end
      or (new.status = 'correct' and (r.timed_out or r.received_at >= a.deadline_at))) then
    raise exception 'Invalid Contrarreloj score';
  end if;
  if challenge_mode = 'time-trial'
    and new.status = 'unanswered' and r.timed_out and r.received_at >= a.deadline_at
    and r.effective_submitted_at = a.deadline_at
    and (r.answer is null or r.answer = 'null'::jsonb) then
    new.review_state := private.attempt_review_state(a.id, new.challenge_item_id);
    if new.review_state->>'type' = 'queens' then
      select q.public_payload, to_jsonb(array(
        select value::integer from jsonb_array_elements_text(s.solution_payload->'solution')
        order by value::integer
      )) into public_payload, solution
      from private.question_versions q
      join private.question_version_solutions s on s.question_version_id = q.id
      where q.id = question_version;
      checkpoint_solved := new.review_state->'queens' = solution
        and (private.queens_progress(a.id, new.challenge_item_id)->>'solved')::boolean;
      if not checkpoint_solved and challenge_config = '{"queensTimeoutPartialCredit":true}'::jsonb then
        required_placements := (public_payload->'grid'->>'rows')::integer
          - jsonb_array_length(public_payload->'prefilledQueens');
        select count(distinct cell.value)::integer into correct_placements
        from jsonb_array_elements(new.review_state->'queens') cell(value)
        where solution @> jsonb_build_array(cell.value)
          and not (public_payload->'prefilledQueens' @> jsonb_build_array(cell.value));
        if required_placements > 0 then
          new.points := least(item_points - 1, item_points * correct_placements / required_placements);
        end if;
      end if;
    elsif new.review_state->>'type' = 'connect-pairs' then
      select q.public_payload into public_payload
      from private.question_versions q where q.id = question_version;
      checkpoint_solved := private.connect_pairs_answer_valid(
        public_payload, jsonb_build_object('paths', new.review_state->'paths'));
      if not checkpoint_solved and challenge_config = '{"connectPairsTimeoutPartialCredit":true}'::jsonb then
        total_pairs := jsonb_array_length(public_payload->'pairs');
        total_cells := (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer;
        -- The review snapshot has already passed the draft validator, including overlap checks.
        select count(*)::integer, coalesce(sum(jsonb_array_length(route.path)), 0)::integer
          into connected_pairs, covered_cells
        from jsonb_array_elements(public_payload->'pairs') pair(value)
        cross join lateral (select new.review_state->'paths'->(pair.value->>'id') as path) route
        where (route.path->0 = pair.value->'endpoints'->0 and route.path->-1 = pair.value->'endpoints'->1)
           or (route.path->0 = pair.value->'endpoints'->1 and route.path->-1 = pair.value->'endpoints'->0);
        new.points := least(item_points - 1, item_points * connected_pairs / total_pairs,
          item_points * covered_cells / total_cells);
        new.result_details := jsonb_build_object('type', 'connect-pairs', 'timeoutPartialCredit', true,
          'connectedPairs', connected_pairs, 'totalPairs', total_pairs, 'coveredCells', covered_cells,
          'totalCells', total_cells, 'coverage', covered_cells::numeric / total_cells, 'conflicts', 0);
      end if;
    end if;
    if checkpoint_solved then
      new.status := 'correct';
      new.points := item_points;
      new.result_details := null;
    elsif new.points > 0 then
      new.status := 'partial';
    end if;
  end if;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$$;

create or replace function private.time_trial_progress(target_attempt uuid) returns jsonb
language sql volatile set search_path = '' as $$
  with facts as (
    select a.*, cv.global_time_limit_ms,
      (select count(*)::integer from private.challenge_items i where i.challenge_version_id = a.challenge_version_id) as total,
      (select count(*)::integer from private.attempt_answers aa where aa.attempt_id = a.id and aa.status = 'correct') as solved,
      (select max(r.effective_submitted_at) from private.attempt_answers aa
        join private.answer_receipts r on r.id = aa.receipt_id
        where aa.attempt_id = a.id and aa.status = 'correct'
          and ((not r.timed_out and r.received_at < a.deadline_at)
            or (r.timed_out and r.effective_submitted_at = a.deadline_at))) as last_correct,
      (select coalesce(sum(points),0)::integer from private.attempt_answers aa where aa.attempt_id = a.id) as earned
    from public.attempts a join private.challenge_versions cv on cv.id = a.challenge_version_id
    where a.id = target_attempt and cv.mode = 'time-trial'
  )
  select jsonb_build_object(
    'kind','time-trial','currentIndex', least(solved,total - 1),
    'solvedCount',solved,'totalCount',total,'points',earned,
    'clockStartedAt',deadline_at - global_time_limit_ms * interval '1 millisecond',
    'deadlineAt',deadline_at,'serverNow',clock_timestamp(),
    'elapsedTimeMs',case when deadline_at is null then 0 else greatest(0,floor(extract(epoch from (
      (case when solved = total then last_correct
        when status = 'completed' and exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status = 'incorrect') then (select max(aa.submitted_at) from private.attempt_answers aa where aa.attempt_id = facts.id)
        else least(coalesce(completed_at,clock_timestamp()),deadline_at) end)
      - (deadline_at - global_time_limit_ms * interval '1 millisecond')))*1000))::bigint end,
    'lastCorrectElapsedMs',floor(extract(epoch from (last_correct - (deadline_at - global_time_limit_ms * interval '1 millisecond'))) * 1000)::bigint,
    'endReason',case
      when terminal_reason in ('all_solved','validation_limit','time_limit','recovery_interrupted') then terminal_reason
      when solved = total then 'all_solved'
      when exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status = 'incorrect') then 'validation_limit'
      when deadline_at is not null and clock_timestamp() >= deadline_at then 'time_limit'
      when exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status <> 'correct') then 'recovery_interrupted'
      else null end
  ) from facts
$$;

create or replace function private.handle_attempt_closure(
  op text,
  input jsonb,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  target_version private.challenge_versions,
  instant timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
  snapshot jsonb;
  points integer;
  target_status text;
  completion_outcome text;
  time_trial_reason text;
  survival_lives integer;
  survival_mistakes integer;
  survival_resolved integer;
  survival_total integer;
  pyramid_resolved integer;
  pyramid_total integer;
  result jsonb;
begin
  clear_progress := false;
  if op = 'complete' then
    if cv.mode in ('alphabet', 'time-trial') then
      -- Preserve an already received answer using the trusted evaluator's result.
      -- No evaluator or asset calls are made while this attempt is locked.
      if input ? 'pendingEvaluation' then
        if jsonb_typeof(input->'pendingEvaluation') is distinct from 'object'
          or not (input->'pendingEvaluation') ?& array['receiptId','status','points']
          or exists (select 1 from jsonb_object_keys(input->'pendingEvaluation') k
            where k <> all(array['receiptId','status','points','resultDetails'])) then
          raise exception 'invalid_command' using errcode = '22023';
        end if;
        select * into receipt from private.answer_receipts r
          where r.id = (input->'pendingEvaluation'->>'receiptId')::uuid and r.attempt_id = a.id
            and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id);
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if receipt.answer is null or receipt.answer = 'null'::jsonb then
          snapshot := private.attempt_review_state(a.id, receipt.challenge_item_id);
        end if;
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
          receipt_id, status, answer, result_details, review_state, points, presented_at, submitted_at,
          time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, a.challenge_version_id, receipt.id,
          input->'pendingEvaluation'->>'status', receipt.answer,
          input->'pendingEvaluation'->'resultDetails', snapshot, (input->'pendingEvaluation'->>'points')::integer,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms,
          'complete:evaluation:' || receipt.id);
      end if;
      if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
        and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
        raise exception 'unfinished_interaction' using errcode = '55000';
      end if;
      if cv.mode = 'time-trial' then
        time_trial_reason := private.time_trial_progress(a.id)->>'endReason';
        if time_trial_reason is null then raise exception 'time_trial_not_terminal' using errcode = '55000'; end if;
        if time_trial_reason = 'time_limit' then
          perform private.close_time_trial_interaction(a.id, a.deadline_at, 'timeout');
          time_trial_reason := private.time_trial_progress(a.id)->>'endReason';
        end if;
      elsif private.next_attempt_item(a.id) is not null then
        if instant < a.deadline_at then
          raise exception 'alphabet_deadline_not_reached' using errcode = '55000',
            detail = jsonb_build_object('retryAfterSeconds',
              greatest(1, ceil(extract(epoch from (a.deadline_at - instant)))::integer))::text;
        end if;
        update private.interaction_intervals x
          set ended_at = greatest(x.started_at, least(instant, a.deadline_at)), end_reason = 'timeout'
          where x.attempt_id = a.id and x.ended_at is null;
        -- Unvisited letters have zero elapsed time and no invented visit.
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id,
          answer, received_at, presented_at, effective_submitted_at, time_used_ms, timed_out)
        select a.id, pending.id, a.challenge_version_id, null, a.deadline_at,
          coalesce(visits.presented_at, a.deadline_at), a.deadline_at,
          coalesce(visits.time_used_ms, 0), true
        from private.challenge_items pending
        left join lateral (
          select min(x.started_at) as presented_at,
            sum(floor(extract(epoch from (x.ended_at - x.started_at)) * 1000))::bigint as time_used_ms
          from private.interaction_intervals x
          where x.attempt_id = a.id and x.challenge_item_id = pending.id
        ) visits on true
        where pending.challenge_version_id = a.challenge_version_id
          and not exists (select 1 from private.attempt_answers aa
            where aa.attempt_id = a.id and aa.challenge_item_id = pending.id)
          and not exists (select 1 from private.answer_receipts r
            where r.attempt_id = a.id and r.challenge_item_id = pending.id);
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
          receipt_id, status, answer, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        select a.id, r.challenge_item_id, a.challenge_version_id, r.id, 'unanswered', r.answer, 0,
          r.presented_at, r.effective_submitted_at, r.time_used_ms,
          'alphabet:timeout:' || r.challenge_item_id
        from private.answer_receipts r where r.attempt_id = a.id
          and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id);
      end if;
    elsif input ? 'pendingEvaluation' then
      raise exception 'invalid_command' using errcode = '22023';
    end if;
    if exists (select 1 from private.interaction_intervals where attempt_id = a.id and ended_at is null)
      or exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
        and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
      raise exception 'unfinished_interaction' using errcode = '55000';
    end if;
    if not exists (select 1 from private.attempt_answers where attempt_id = a.id) then
      raise exception 'no_evaluated_answers' using errcode = '55000';
    end if;
    if cv.mode = 'survival' then
      select count(*)::integer,
        coalesce(sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when answer_question.type = 'queens'
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0
        end), 0)::integer
      into survival_resolved, survival_mistakes
      from private.attempt_answers answer
      join private.challenge_items answer_item on answer_item.id = answer.challenge_item_id
      join private.question_versions answer_question on answer_question.id = answer_item.question_version_id
      where answer.attempt_id = a.id;
      select count(*)::integer into survival_total
      from private.challenge_items challenge_item
      where challenge_item.challenge_version_id = a.challenge_version_id;
      survival_lives := greatest((cv.mode_config->>'lives')::integer - survival_mistakes, 0);
      if survival_lives > 0 and survival_resolved < survival_total then
        raise exception 'survival_not_terminal' using errcode = '55000';
      end if;
      completion_outcome := case when survival_lives = 0 then 'eliminated' else 'survived' end;
    elsif cv.mode = 'pyramid' then
      select count(*)::integer into pyramid_total
      from private.challenge_items challenge_item
      where challenge_item.challenge_version_id = a.challenge_version_id;
      select count(*)::integer into pyramid_resolved
      from private.attempt_answers answer where answer.attempt_id = a.id;
      if exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then
        completion_outcome := 'failed';
      elsif pyramid_total = 7 and pyramid_resolved = pyramid_total then
        completion_outcome := 'summit';
      else
        raise exception 'pyramid_not_terminal' using errcode = '55000';
      end if;
    elsif cv.mode in ('alphabet', 'time-trial') then
      completion_outcome := null;
    else
      if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
        raise exception 'incomplete_challenge' using errcode = '55000';
      end if;
      completion_outcome := null;
    end if;
    select coalesce(sum(answer.points), 0)::integer into points
    from private.attempt_answers answer where answer.attempt_id = a.id;
    target_status := 'completed';
  else
    target_status := 'abandoned'; points := null; completion_outcome := null;
    update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
      from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
  end if;
  delete from private.prepared_interactions where attempt_id = a.id;
  update public.attempts set status = target_status, score = points, completed_at = instant,
    terminal_reason = case when cv.mode = 'time-trial' and op = 'complete' then time_trial_reason else terminal_reason end,
    outcome = completion_outcome, progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
  update private.attempt_sessions
  set revoked_at = instant, revocation_reason = 'terminal'
  where attempt_id = a.id and revoked_at is null;
  if op = 'complete' then
    insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
    values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
  end if;
  result := jsonb_build_object('status', a.status, 'score', a.score,
    'outcome', a.outcome, 'challengeMode', cv.mode,
    'livesRemaining', case when cv.mode = 'survival' then survival_lives else null end);
  if op = 'complete' and cv.mode in ('alphabet', 'time-trial') then
    result := result || jsonb_build_object('answers', coalesce((
      select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
        'answer', aa.answer, 'status', aa.status, 'points', aa.points,
        'timeUsedMs', aa.time_used_ms, 'resultDetails', aa.result_details,
        'reviewState', aa.review_state) order by ci.position)
      from private.attempt_answers aa join private.challenge_items ci on ci.id = aa.challenge_item_id
      where aa.attempt_id = a.id
    ), '[]'::jsonb));
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
