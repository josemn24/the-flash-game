-- Allow opt-in Pyramid credit for matching, classification and ordering.
set local check_function_bodies = off;

alter table private.attempt_answers drop constraint attempt_answers_review_state_check;
alter table private.attempt_answers add constraint attempt_answers_review_state_check check (review_state is null or (
    jsonb_typeof(review_state) = 'object' and (
      (review_state->>'type' = 'connect-pairs' and jsonb_typeof(review_state->'paths') = 'object') or
      (review_state->>'type' = 'queens' and jsonb_typeof(review_state->'queens') = 'array') or
      (review_state->>'type' = 'word-search' and jsonb_typeof(review_state->'foundWordIds') = 'array') or
      (review_state->>'type' in ('matching', 'classification') and jsonb_typeof(review_state->'answer') = 'object') or
      (review_state->>'type' = 'ordering' and jsonb_typeof(review_state->'answer') = 'array')
    )
  ));

create or replace function private.is_valid_pyramid_config(config jsonb, question_types text[]) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(config) = 'object' then not exists (
    select 1 from jsonb_each(config) option
    where option.value <> 'true'::jsonb
      or not coalesce((case option.key
        when 'connectPairsTimeoutPartialCredit' then 'connect-pairs'
        when 'wordSearchTimeoutPartialCredit' then 'word-search'
        when 'queensTimeoutPartialCredit' then 'queens'
        when 'matchingPartialCredit' then 'matching'
        when 'classificationPartialCredit' then 'classification'
        when 'orderingPartialCredit' then 'ordering'
      end) = any(question_types), false)
  ) else false end;
$$;

create function private.pyramid_draft_enabled(config jsonb, format text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(config->(case format
    when 'matching' then 'matchingPartialCredit'
    when 'classification' then 'classificationPartialCredit'
    when 'ordering' then 'orderingPartialCredit'
  end) = 'true'::jsonb, false);
$$;

create function private.pyramid_draft_valid(
  format text, payload jsonb, answer jsonb, require_complete boolean
) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if format = 'ordering' then
    if jsonb_typeof(answer) is distinct from 'array' then return false; end if;
    if jsonb_array_length(answer) <> jsonb_array_length(payload->'items') then return false; end if;
    return (select count(distinct value) = count(*)
      and coalesce(bool_and(jsonb_typeof(value) = 'string' and payload->'items' @> jsonb_build_array(value)), false)
      from jsonb_array_elements(answer));
  end if;
  if jsonb_typeof(answer) is distinct from 'object' then return false; end if;
  if exists (select 1 from jsonb_each(answer) pair where jsonb_typeof(pair.value) <> 'string')
    then return false; end if;
  if format = 'matching' then
    return private.matching_answer_valid(payload, answer, require_complete);
  elsif format = 'classification' then
    return (not require_complete or
      (select count(*) from jsonb_object_keys(answer)) = jsonb_array_length(payload->'items'))
      and not exists (
        select 1 from jsonb_each(answer) pair
        where not (payload->'items' @> jsonb_build_array(jsonb_build_object('label', pair.key)))
          or not (payload->'categories' @> jsonb_build_array(pair.value))
      );
  end if;
  return false;
end;
$$;

alter function private.pyramid_draft_enabled(jsonb, text) owner to postgres;
alter function private.pyramid_draft_valid(text, jsonb, jsonb, boolean) owner to postgres;
revoke all on function private.pyramid_draft_enabled(jsonb, text),
  private.pyramid_draft_valid(text, jsonb, jsonb, boolean) from public, anon, authenticated, service_role;

create or replace function public.get_my_competitive_challenge(target_room_slug text, target_publication_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare challenge_mode text; challenge_rows jsonb;
begin
  select version.mode into challenge_mode
  from public.scheduled_challenges publication
  join public.seasons season on season.id = publication.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = publication.challenge_version_id
  where publication.id = target_publication_id and room.slug = target_room_slug;

  case challenge_mode
    when 'time-trial' then
      select jsonb_agg(to_jsonb(row) || jsonb_build_object(
        'queens_timeout_partial_credit', version.mode_config = '{"queensTimeoutPartialCredit":true}'::jsonb,
        'connect_pairs_timeout_partial_credit', version.mode_config = '{"connectPairsTimeoutPartialCredit":true}'::jsonb
      ) order by row.item_position) into challenge_rows
      from public.get_my_time_trial_challenge(target_room_slug, target_publication_id) row
      join private.challenge_versions version on version.id = row.challenge_version_id;
    when 'flash' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_flash_challenge(target_room_slug, target_publication_id) row;
    when 'alphabet' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_alphabet_challenge(target_room_slug, target_publication_id) row;
    when 'survival' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_survival_challenge(target_room_slug, target_publication_id) row;
    when 'pyramid' then
      select jsonb_agg(to_jsonb(row) || jsonb_strip_nulls(jsonb_build_object(
        'connect_pairs_timeout_partial_credit', version.mode_config->'connectPairsTimeoutPartialCredit',
        'word_search_timeout_partial_credit', version.mode_config->'wordSearchTimeoutPartialCredit',
        'queens_timeout_partial_credit', version.mode_config->'queensTimeoutPartialCredit',
        'matching_partial_credit', version.mode_config->'matchingPartialCredit',
        'classification_partial_credit', version.mode_config->'classificationPartialCredit',
        'ordering_partial_credit', version.mode_config->'orderingPartialCredit'
      )) order by row.item_position) into challenge_rows
      from public.get_my_pyramid_challenge(target_room_slug, target_publication_id) row
      join private.challenge_versions version on version.id = row.challenge_version_id;
    when 'narrative' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_narrative_challenge(target_room_slug, target_publication_id) row;
    else return null;
  end case;

  -- Never disclose even the mode for an absent/inaccessible projection.
  if challenge_rows is null then return null; end if;
  return jsonb_build_object('mode', challenge_mode, 'rows', challenge_rows);
end;
$$;

create or replace function private.guard_answer() returns trigger
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype;
  r private.answer_receipts%rowtype;
  item_points integer;
  challenge_mode text;
  challenge_config jsonb;
  question_version uuid;
  question_format text;
  question_limit_ms integer;
  draft_answer jsonb;
  correct_items integer;
  total_items integer;
  scoring_time_ms bigint;
  public_payload jsonb;
  solution jsonb;
  checkpoint_solved boolean := false;
  checkpoint_deadline timestamptz;
  checkpoint_saved_at timestamptz;
  pyramid_connect_pairs boolean;
  pyramid_queens boolean;
  pyramid_word_search boolean;
  queens_progress jsonb;
  saved_speed_score integer;
  found_word_ids jsonb;
  total_words integer;
  incorrect_selections integer;
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
  select i.points, cv.mode, cv.mode_config, i.question_version_id, q.type, q.time_limit_ms,
    cv.mode = 'pyramid' and q.type = 'connect-pairs'
      and coalesce(cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'queens'
      and coalesce(cv.mode_config->'queensTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'word-search'
      and coalesce(cv.mode_config->'wordSearchTimeoutPartialCredit' = 'true'::jsonb, false)
    into item_points, challenge_mode, challenge_config, question_version, question_format, question_limit_ms,
      pyramid_connect_pairs, pyramid_queens, pyramid_word_search
  from private.challenge_items i
  join private.challenge_versions cv on cv.id = i.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  where i.id = new.challenge_item_id;
  if challenge_mode = 'pyramid' and private.pyramid_draft_enabled(challenge_config, question_format) then
    new.status := 'unanswered';
    new.points := 0;
    new.result_details := null;
    new.review_state := null;
    if r.timed_out then
      select unit.deadline_at into checkpoint_deadline
      from private.attempt_timing_units unit
      where unit.attempt_id = a.id and unit.challenge_item_id = new.challenge_item_id
        and unit.scope = 'level';
      if checkpoint_deadline is null or r.received_at < checkpoint_deadline
        or r.effective_submitted_at <> checkpoint_deadline
        or a.progress_payload->>'kind' is distinct from 'pyramid-draft'
        or a.progress_payload->>'challengeItemId' is distinct from new.challenge_item_id::text then
        return new;
      end if;
      checkpoint_saved_at := (a.progress_payload->>'savedAt')::timestamptz;
      if checkpoint_saved_at is null or checkpoint_saved_at < r.presented_at
        or checkpoint_saved_at >= checkpoint_deadline then return new; end if;
      draft_answer := a.progress_payload->'answer';
      scoring_time_ms := floor(extract(epoch from (checkpoint_saved_at - r.presented_at)) * 1000)::bigint;
    else
      draft_answer := r.answer;
      scoring_time_ms := r.time_used_ms;
    end if;
    if draft_answer is null or draft_answer = 'null'::jsonb then return new; end if;

    select s.solution_payload into solution
    from private.question_version_solutions s where s.question_version_id = question_version;
    if question_format = 'ordering' then
      solution := solution->'correctOrder';
      total_items := jsonb_array_length(solution);
      select count(*)::integer into correct_items
      from jsonb_array_elements(draft_answer) with ordinality chosen(value, position)
      where chosen.value = solution->(chosen.position::integer - 1);
    else
      solution := solution->(case question_format when 'matching' then 'matches' else 'categoriesByItem' end);
      select count(*)::integer, count(*) filter (where value = draft_answer->key)::integer
        into total_items, correct_items
      from jsonb_each(solution);
    end if;
    if total_items is null or total_items <= 0 then return new; end if;
    if r.timed_out then
      new.review_state := jsonb_build_object('type', question_format, 'answer', draft_answer);
    end if;
    new.result_details := jsonb_build_object('type', question_format) ||
      case when question_format = 'matching'
        then jsonb_build_object('correctPairs', correct_items, 'totalPairs', total_items)
        else jsonb_build_object('correctItems', correct_items, 'totalItems', total_items) end;
    if correct_items = total_items then
      new.status := 'correct';
      new.points := round(item_points * (1 - 0.4 *
        least(scoring_time_ms, question_limit_ms)::numeric / question_limit_ms))::integer;
    else
      new.points := least(item_points - 1, item_points * correct_items / total_items);
      if new.points > 0 then
        new.status := 'partial';
        new.result_details := new.result_details || jsonb_build_object(
          'pyramidPartialCredit', case when r.timed_out then 'timeout' else 'submission' end);
      elsif not r.timed_out then
        new.status := 'incorrect';
      end if;
    end if;
    return new;
  end if;
  if (pyramid_queens or pyramid_word_search) and not r.timed_out
    and (r.answer is null or r.answer = 'null'::jsonb) then
    new.status := 'unanswered';
    new.points := 0;
    return new;
  end if;
  if challenge_mode = 'time-trial' then
    checkpoint_deadline := a.deadline_at;
  elsif r.timed_out and (pyramid_connect_pairs or pyramid_queens or pyramid_word_search) then
    select unit.deadline_at into checkpoint_deadline
    from private.attempt_timing_units unit
    where unit.attempt_id = a.id and unit.challenge_item_id = new.challenge_item_id
      and unit.scope = 'level';
    checkpoint_saved_at := (a.progress_payload->>'savedAt')::timestamptz;
  end if;
  if challenge_mode = 'time-trial'
    and (new.status = 'partial' or new.points <> case when new.status = 'correct' then item_points else 0 end
      or (new.status = 'correct' and (r.timed_out or r.received_at >= a.deadline_at))) then
    raise exception 'Invalid Contrarreloj score';
  end if;
  if ((challenge_mode = 'time-trial' and new.status = 'unanswered')
      or pyramid_connect_pairs or pyramid_queens or pyramid_word_search)
    and r.timed_out and r.received_at >= checkpoint_deadline
    and r.effective_submitted_at = checkpoint_deadline
    and (r.answer is null or r.answer = 'null'::jsonb) then
    if challenge_mode = 'pyramid' then
      new.status := 'unanswered';
      new.points := 0;
    end if;
    if pyramid_word_search then
      select coalesce(jsonb_agg(e.matched_target_id order by e.sequence) filter (where e.correct), '[]'::jsonb),
        count(*) filter (where not e.correct)::integer
        into found_word_ids, incorrect_selections
      from private.word_search_selection_events e
      where e.attempt_id = a.id and e.challenge_item_id = new.challenge_item_id
        and e.received_at >= r.presented_at and e.received_at < checkpoint_deadline;
      select jsonb_array_length(q.public_payload->'targets') into total_words
      from private.question_versions q where q.id = question_version;
      if total_words > 0 and jsonb_array_length(found_word_ids) > 0 then
        new.review_state := jsonb_build_object('type', 'word-search', 'foundWordIds', found_word_ids);
        new.points := least(item_points - 1, item_points * jsonb_array_length(found_word_ids) / total_words);
        new.result_details := jsonb_build_object('type', 'word-search', 'timeoutPartialCredit', true,
          'foundWords', jsonb_array_length(found_word_ids), 'totalWords', total_words,
          'incorrectSelections', incorrect_selections, 'solved', false);
        if new.points > 0 then new.status := 'partial'; end if;
      end if;
      return new;
    end if;
    if challenge_mode = 'pyramid' and
      (checkpoint_saved_at is null or checkpoint_saved_at < r.presented_at or checkpoint_saved_at >= checkpoint_deadline)
    then return new; end if;

    new.review_state := private.attempt_review_state(a.id, new.challenge_item_id);
    -- A saved board with all crowns fixed can be solved without any own placements.
    if pyramid_queens and new.review_state is null and a.progress_payload->>'kind' = 'queens'
      and a.progress_payload->>'challengeItemId' = new.challenge_item_id::text then
      select jsonb_build_object('type', 'queens', 'queens', a.progress_payload->'queens') into new.review_state
      from private.question_versions q
      where q.id = question_version and jsonb_array_length(q.public_payload->'prefilledQueens')
        = (q.public_payload->'grid'->>'rows')::integer;
    end if;
    if new.review_state->>'type' = 'queens' then
      select q.public_payload, to_jsonb(array(
        select value::integer from jsonb_array_elements_text(s.solution_payload->'solution')
        order by value::integer
      )) into public_payload, solution
      from private.question_versions q
      join private.question_version_solutions s on s.question_version_id = q.id
      where q.id = question_version;
      queens_progress := private.queens_progress(a.id, new.challenge_item_id);
      checkpoint_solved := new.review_state->'queens' = solution
        and (queens_progress->>'solved')::boolean;
      if pyramid_queens and (queens_progress->>'incorrectValidations')::integer >= 3 then
        return new;
      end if;
      if not checkpoint_solved and (pyramid_queens
        or challenge_config = '{"queensTimeoutPartialCredit":true}'::jsonb) then
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
      if pyramid_queens then
        new.result_details := jsonb_build_object('type', 'queens',
          'placedQueens', queens_progress->'placedQueens', 'completedRows', queens_progress->'completedRows',
          'completedColumns', queens_progress->'completedColumns', 'completedRegions', queens_progress->'completedRegions',
          'conflictingQueens', queens_progress->'conflictingQueens', 'incorrectAttempts', queens_progress->'incorrectValidations',
          'marksUsed', 0, 'solved', checkpoint_solved);
        if not checkpoint_solved then
          new.result_details := new.result_details || jsonb_build_object('timeoutPartialCredit', true,
            'correctPlacements', correct_placements, 'requiredPlacements', required_placements);
        end if;
      end if;
    elsif new.review_state->>'type' = 'connect-pairs' then
      select q.public_payload into public_payload
      from private.question_versions q where q.id = question_version;
      checkpoint_solved := private.connect_pairs_answer_valid(
        public_payload, jsonb_build_object('paths', new.review_state->'paths'));
      if not checkpoint_solved and (pyramid_connect_pairs
        or challenge_config = '{"connectPairsTimeoutPartialCredit":true}'::jsonb) then
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
      if pyramid_connect_pairs or pyramid_queens then
        -- Score the solved checkpoint at its accepted save time.
        saved_speed_score := round(item_points * (1 - 0.4 *
          floor(extract(epoch from (checkpoint_saved_at - r.presented_at)) * 1000)
            / (extract(epoch from (checkpoint_deadline - r.presented_at)) * 1000)))::integer;
        new.points := saved_speed_score;
        if pyramid_queens then
          new.points := greatest(0, greatest(saved_speed_score, ceil(item_points * 0.6)::integer)
            - round(item_points * 0.05)::integer * (queens_progress->>'incorrectValidations')::integer);
        end if;
      end if;
      if not pyramid_queens then new.result_details := null; end if;
    elsif new.points > 0 then
      new.status := 'partial';
    end if;
  end if;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$$;

create or replace function private.handle_attempt_evaluation(
  input jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  key text := input->>'idempotencyKey';
  receipt private.answer_receipts%rowtype;
  snapshot jsonb;
  saved private.attempt_answers%rowtype;
  result jsonb;
begin
  clear_progress := false;
  select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
  if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
  if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
    raise exception 'already_evaluated' using errcode = '55000';
  end if;
  if receipt.answer is null or receipt.answer = 'null'::jsonb then
    snapshot := private.attempt_review_state(a.id, receipt.challenge_item_id);
  end if;
  -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
  insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
    status, answer, result_details, review_state, points, presented_at, submitted_at, time_used_ms, idempotency_key)
  values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
    input->>'status', receipt.answer, input->'resultDetails', snapshot,
    case when cv.mode = 'time-trial' then case when input->>'status' = 'correct' then (select allocated.points from private.challenge_items allocated where allocated.id = receipt.challenge_item_id) else 0 end when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
      else (input->>'points')::integer end,
    receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key)
  returning * into saved;
  result := jsonb_build_object('receiptId', receipt.id, 'status', saved.status,
    'points', saved.points) || jsonb_strip_nulls(jsonb_build_object('reviewState', saved.review_state,
      'details', case when saved.result_details->'timeoutPartialCredit' = 'true'::jsonb
        or saved.result_details ? 'pyramidPartialCredit'
        or (cv.mode = 'pyramid' and saved.review_state->>'type' in ('matching', 'classification', 'ordering'))
        or (cv.mode = 'pyramid' and receipt.timed_out and saved.status = 'correct'
          and saved.review_state->>'type' = 'queens') then saved.result_details end));
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;

create or replace function private.handle_attempt_submission(
  op text,
  input jsonb,
  target_attempt public.attempts,
  target_version private.challenge_versions,
  instant timestamptz,
  received_at timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  cv private.challenge_versions%rowtype := target_version;
  received timestamptz := received_at;
  question_type text;
  question_payload jsonb;
  pyramid_draft boolean := false;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  unit private.attempt_timing_units%rowtype;
  receipt private.answer_receipts%rowtype;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  result jsonb;
begin
  clear_progress := false;
  if cv.mode = 'time-trial' then received := clock_timestamp(); end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  select q.type, q.public_payload into question_type, question_payload
    from private.question_versions q where q.id = item.question_version_id;
  pyramid_draft := cv.mode = 'pyramid' and private.pyramid_draft_enabled(cv.mode_config, question_type);
  if cv.mode = 'time-trial' then
    if question_type = 'queens' and (op = 'pass' or received < a.deadline_at) then
      raise exception 'queens_requires_validation_command' using errcode = '22023';
    elsif question_type = 'connect-pairs' then
      if op = 'pass' then raise exception 'pass_unavailable' using errcode = '55000'; end if;
      if received >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
      if not private.connect_pairs_answer_valid(question_payload, input->'answer') then
        raise exception 'invalid_connect_pairs_answer' using errcode = '22023';
      end if;
    end if;
  end if;
  if op = 'receive' and pyramid_draft and received < unit.deadline_at
    and input->'answer' <> 'null'::jsonb
    and not private.pyramid_draft_valid(question_type, question_payload, input->'answer', true) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if op = 'receive' and not pyramid_draft and question_type = 'matching' and (
    (instant < unit.deadline_at and not private.matching_answer_valid(
      (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
      input->'answer',
      true
    ))
    or (instant >= unit.deadline_at and jsonb_typeof(input->'answer') <> 'null'
      and not private.matching_answer_valid(
        (select q.public_payload from private.question_versions q where q.id = item.question_version_id),
        input->'answer',
        false
      ))
  ) then
    raise exception 'invalid_matching_answer' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'mini-wordle'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'logic-code'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'queens'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'queens_requires_placement_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-search'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_search_requires_selection_command' using errcode = '22023';
  end if;
  if op = 'receive' and exists (
    select 1 from private.question_versions q
    where q.id = item.question_version_id and q.type = 'word-hashtag'
  ) and jsonb_typeof(input->'answer') <> 'null' then
    raise exception 'word_hashtag_requires_swap_command' using errcode = '22023';
  end if;
  -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
  if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  late := received >= unit.deadline_at;
  effective := least(received, unit.deadline_at);
  if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
  update private.interaction_intervals set ended_at = effective,
    end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
  if op = 'pass' then result := jsonb_build_object('passed', true);
  else
    select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
      into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
    insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
      received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, segment.challenge_item_id, a.challenge_version_id,
      case when late and pyramid_draft then null
      when late and cv.mode = 'pyramid'
        and cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb
        and exists (select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'connect-pairs') then null
      when input->'answer' = 'null'::jsonb and exists (
        select 1 from private.question_versions timeout_question
        where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
      ) then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
      else input->'answer' end,
      received, presented,
      effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
    if input->'answer' = 'null'::jsonb and exists (
      select 1 from private.question_versions timeout_question
      where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
    ) then
      clear_progress := true;
    end if;
    result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
      'receivedAt', received, 'presentedAt', presented);
  end if;
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;

create or replace function private.handle_attempt_command(
  op text,
  input jsonb,
  safe_input jsonb,
  actor uuid,
  cached_result jsonb,
  received_at timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  operation_outcome record;
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  is_admin boolean;
  clear_progress boolean := false;
  allow_stale_timeout boolean := false;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust','regrade_answer') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'regrade_answer' and not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if op = 'start' then
    return private.handle_attempt_start(input, safe_input, actor, cached_result, is_admin);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op = 'takeover' and a.scheduled_challenge_id <> (input->>'scheduledChallengeId')::uuid then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if op not in ('invalidate','adjust','regrade_answer') then
      if a.player_id <> actor or a.kind <> 'competitive' or is_admin or not exists (
        select 1 from public.seasons s join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id
        where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
          and m.status = 'active' and m.role in ('owner','admin','member')
      ) then raise exception 'not_authorized' using errcode = '42501'; end if;
      if op <> 'takeover' then
        select * into session_row from private.attempt_sessions where attempt_id = a.id
          and session_token_hash = safe_input->>'sessionToken';
        if not found then
          raise exception 'session_revoked' using errcode = '42501';
        elsif session_row.revoked_at is not null then
          if session_row.revocation_reason = 'takeover' then
            raise exception 'session_transferred' using errcode = '42501';
          end if;
          if not (op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')) then
            raise exception 'session_revoked' using errcode = '42501';
          end if;
        end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached_result is not null then return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    expected := (input->>'lockVersion')::bigint;
    if expected is distinct from a.lock_version then
      allow_stale_timeout := expected < a.lock_version and (
        (op = 'receive' and input->'answer' = 'null'::jsonb and exists (
          select 1 from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and received >= unit.deadline_at
        )) or
        (op = 'receive' and input->'answer' <> 'null'::jsonb and exists (
          select 1
          from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          join private.challenge_items item on item.id = ix.challenge_item_id
          join private.question_versions question on question.id = item.question_version_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and ix.challenge_item_id = (input->>'challengeItemId')::uuid
            and (
              (question.type = 'connect-pairs' and received < unit.deadline_at
                and (cv.mode <> 'time-trial' or received < a.deadline_at))
              or (cv.mode = 'pyramid' and private.pyramid_draft_enabled(cv.mode_config, question.type)
                and a.progress_payload->>'kind' = 'pyramid-draft'
                and a.progress_payload->>'challengeItemId' = ix.challenge_item_id::text
                and (a.progress_payload->>'baseRevision')::bigint = expected
                and a.lock_version = expected + 1)
            )
        )) or
        (op = 'complete' and cv.mode = 'time-trial' and a.deadline_at is not null
          and received >= a.deadline_at
          and private.time_trial_progress(a.id)->>'endReason' = 'time_limit')
      );
      if not allow_stale_timeout then
        raise exception 'stale_version' using errcode = '40001';
      end if;
    end if;
    if op not in ('invalidate','adjust','regrade_answer') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','regrade_answer','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        select * into operation_outcome from private.handle_attempt_takeover(input, safe_input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'prepare' then
        select * into operation_outcome from private.handle_attempt_prepare(a, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'activate' then
        if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
        select * into operation_outcome from private.handle_attempt_activate(input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'receive', 'pass' then
        select * into operation_outcome from private.handle_attempt_submission(op, input, a, cv, instant, received);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'evaluate' then
        select * into operation_outcome from private.handle_attempt_evaluation(input, a, cv);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'complete', 'abandon' then
        select * into operation_outcome from private.handle_attempt_closure(op, input, a, sc, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'invalidate', 'adjust', 'regrade_answer' then
        result := private.handle_attempt_admin_command(op, input, actor, a, sc, instant, key);
        select * into a from public.attempts where id = a.id;
    end case;
    if op not in ('complete','abandon','invalidate','adjust','regrade_answer') then
      update public.attempts
        set lock_version = lock_version + 1,
            last_activity_at = instant,
            progress_payload = case when clear_progress then null else progress_payload end
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
    if cv.mode = 'time-trial' then
      result := result || jsonb_build_object('timeTrial', private.time_trial_progress(a.id), 'terminalReason', a.terminal_reason);
    end if;
  end if;

  return jsonb_build_object(
    'result', result,
    'entityType', 'attempt',
    'entityId', a.id,
    'beforePayload', previous,
    'replayed', false
  );
end;
$$;

-- Guarded checkpoint for the three opt-in Pyramid answer formats.
set local check_function_bodies = off;

create function private.save_pyramid_draft(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  version private.challenge_versions%rowtype;
  instant timestamptz;
  expected bigint;
  snapshot jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer'
    ]))
    or jsonb_typeof(input->'answer') not in ('array', 'object') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_pyramid_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  select * into version from private.challenge_versions where id = a.challenge_version_id;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if version.mode <> 'pyramid' or question.payload_schema_version <> 1
    or not private.pyramid_draft_enabled(version.mode_config, question.type)
    or not private.pyramid_draft_valid(question.type, question.public_payload, input->'answer', false)
  then raise exception 'invalid_command' using errcode = '22023'; end if;
  instant := clock_timestamp();
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;

  snapshot := jsonb_build_object('type', question.type, 'answer', input->'answer');
  update public.attempts set
    progress_payload = jsonb_build_object('kind', 'pyramid-draft', 'challengeItemId', item.id,
      'answer', input->'answer', 'savedAt', instant, 'baseRevision', expected),
    lock_version = lock_version + 1,
    last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object('attemptId', a.id, 'challengeItemId', item.id,
    'lockVersion', a.lock_version, 'reviewState', snapshot);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_pyramid_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_pyramid_draft', safe_input, result);
  return result;
end;
$$;

alter function private.save_pyramid_draft(jsonb) owner to postgres;
revoke all on function private.save_pyramid_draft(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.save_pyramid_draft(jsonb) to service_role;
