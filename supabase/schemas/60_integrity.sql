-- These guards reinforce structural invariants. They do not implement the 31 scoring
-- contracts or replace authorized, transactional application commands. See README.md.
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.guard_player() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id then raise exception 'Player identity is immutable'; end if;
  if old.status = 'anonymized' and new is distinct from old then
    raise exception 'Anonymized player cannot be restored by an ordinary update';
  end if;
  if (old.auth_user_id is not null and new.auth_user_id is null) or new.status = 'anonymized' then
    new.auth_user_id := null;
    new.display_name := 'Participante anonimizado';
    new.avatar_path := null;
    new.status := 'anonymized';
    new.anonymized_at := coalesce(old.anonymized_at, statement_timestamp());
  end if;
  return new;
end;
$$;
create trigger players_guard before update on public.players
  for each row execute function private.guard_player();

create function private.guard_room() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then raise exception 'Room identity is immutable'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone';
  end if;
  return new;
end;
$$;
create trigger rooms_guard before insert or update on public.rooms
  for each row execute function private.guard_room();

create function private.lock_membership_room() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id, new.room_id, new.player_id) is distinct from
    (old.id, old.room_id, old.player_id) then raise exception 'Membership identity is immutable'; end if;
  perform 1 from public.rooms where id = coalesce(new.room_id, old.room_id) for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger memberships_lock before insert or update or delete on public.room_memberships
  for each row execute function private.lock_membership_room();

create function private.require_room_owner() returns trigger
language plpgsql set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'rooms' then target_id := new.id;
  else target_id := coalesce(new.room_id, old.room_id); end if;
  if exists (select 1 from public.rooms where id = target_id and status = 'active')
    and (select count(*) from public.room_memberships where room_id = target_id
      and role = 'owner' and status = 'active') <> 1 then
    raise exception 'An active room requires exactly one active owner';
  end if;
  return null;
end;
$$;
create constraint trigger rooms_require_owner after insert or update on public.rooms
  deferrable initially deferred for each row execute function private.require_room_owner();
create constraint trigger memberships_require_owner after insert or update or delete on public.room_memberships
  deferrable initially deferred for each row execute function private.require_room_owner();

create function private.guard_season() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.id, new.room_id) is distinct from (old.id, old.room_id) then
    raise exception 'Season identity and room are immutable';
  end if;
  if old.status in ('finished', 'cancelled') and new is distinct from old then
    raise exception 'Terminal seasons are immutable; corrections require a dedicated audited operation';
  end if;
  if old.status <> 'draft' and new.title is distinct from old.title then
    raise exception 'Only draft seasons may change their title';
  end if;
  perform private.assert_season_calendar_window(old,new.starts_at,new.ends_at,clock_timestamp());
  if old.status = 'active' and new.status not in ('active', 'finished', 'cancelled') then
    raise exception 'An active season cannot return to preparation';
  end if;
  return new;
end;
$$;
create trigger seasons_guard before update on public.seasons
  for each row execute function private.guard_season();

create function private.guard_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Create a draft before publishing'; end if;
    return new;
  end if;
  if old.status <> 'draft' then
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'archived'
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'Published content is immutable; create another version';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id then raise exception 'Version identity is immutable'; end if;
  if new.status = 'archived' then raise exception 'Publish before archiving a version'; end if;
  if new.status = 'published' then
    if tg_table_name = 'question_versions' then
      if not exists (select 1 from private.question_version_solutions where question_version_id = new.id) then
        raise exception 'A published question requires a solution';
      end if;
    else
      perform 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id for share of q;
      if (select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = new.id) <> 100 then
        raise exception 'Challenge items must sum to 100 points';
      end if;
      if new.mode = 'time-trial' then
        -- The content assertion reads the saved draft by ID.
        if new.mode is distinct from old.mode or new.mode_config is distinct from old.mode_config then
          raise exception 'invalid_time_trial_content' using errcode = '22023';
        end if;
        perform private.assert_time_trial_content(new.id);
      elsif new.mode = 'pyramid' and not private.is_valid_pyramid_config(new.mode_config, array(
        select q.type from private.challenge_items item join private.question_versions q on q.id = item.question_version_id
        where item.challenge_version_id = new.id
      )) then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      if exists (select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id and q.status <> 'published') then
        raise exception 'Publish every question before its challenge';
      end if;
    end if;
    new.published_at := statement_timestamp();
  end if;
  return new;
end;
$$;
create trigger questions_freeze before insert or update or delete on private.question_versions
  for each row execute function private.guard_version();
create trigger challenges_freeze before insert or update or delete on private.challenge_versions
  for each row execute function private.guard_version();

create function private.guard_content_child() returns trigger
language plpgsql set search_path = '' as $$
declare parent_id uuid; parent_status text;
begin
  if tg_table_name = 'challenge_items' then
    parent_id := coalesce(new.challenge_version_id, old.challenge_version_id);
    if tg_op = 'UPDATE' and (new.id, new.challenge_version_id) is distinct from (old.id, old.challenge_version_id) then
      raise exception 'Item identity and parent are immutable';
    end if;
    select status into parent_status from private.challenge_versions where id = parent_id for update;
  else
    parent_id := coalesce(new.question_version_id, old.question_version_id);
    if tg_op = 'UPDATE' and new.question_version_id <> old.question_version_id then
      raise exception 'Solution parent is immutable';
    end if;
    select status into parent_status from private.question_versions where id = parent_id for update;
  end if;
  if parent_status is distinct from 'draft' then raise exception 'Published children are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger items_freeze before insert or update or delete on private.challenge_items
  for each row execute function private.guard_content_child();
create trigger solutions_freeze before insert or update or delete on private.question_version_solutions
  for each row execute function private.guard_content_child();

create function private.guard_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.season_id) is distinct from (old.id, old.season_id) then
      raise exception 'Publication identity and season are immutable';
    end if;
    perform private.assert_publication_calendar_window(old,new.opens_at,new.closes_at,clock_timestamp());
    if (new.number,new.challenge_version_id) is distinct from (old.number,old.challenge_version_id)
      and not coalesce((private.publication_calendar_permissions(old,clock_timestamp())->>'canEditWindow')::boolean,false) then
      raise exception 'opening_reached' using errcode='55000';
    end if;
    if old.status in ('closed', 'cancelled') and new.status not in (old.status, 'cancelled') then
      raise exception 'A terminal publication cannot reopen';
    end if;
    if old.status = 'open' and new.status not in ('open', 'closed', 'cancelled')
      and not coalesce((private.publication_calendar_permissions(old,clock_timestamp())->>'canEditWindow')::boolean,false) then
      raise exception 'An open publication cannot return to scheduled';
    end if;
  end if;
  if tg_op = 'INSERT' or new.challenge_version_id is distinct from old.challenge_version_id then
    perform 1 from private.challenge_versions where id = new.challenge_version_id and status = 'published' for share;
    if not found then raise exception 'A publication requires a published challenge version'; end if;
  end if;
  return new;
end;
$$;
create trigger publications_guard before insert or update on public.scheduled_challenges
  for each row execute function private.guard_publication();

-- Admit attempts against the effective publication window. A delayed calendar
-- tick must not block a live window, and a closed or finished window rejects new attempts.
create function private.guard_attempt() returns trigger
language plpgsql set search_path = '' as $$
declare attempt_mode text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' then raise exception 'An attempt must start in progress'; end if;
    new.started_at := clock_timestamp();
    -- Derive the global clock from the exact persisted start, including very short limits.
    -- Other modes have only question/level clocks; never accept a caller's global deadline.
    select case when cv.mode = 'alphabet' then
      new.started_at + cv.global_time_limit_ms * interval '1 millisecond' else null end
      into new.deadline_at from private.challenge_versions cv where cv.id = new.challenge_version_id;
    if new.kind = 'competitive' then
      if exists (select 1 from private.platform_role_assignments where player_id = new.player_id) then
        raise exception 'Superadministrators only create test attempts';
      end if;
      perform 1 from public.scheduled_challenges sc
        join public.seasons s on s.id = sc.season_id
        join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id and m.player_id = new.player_id
        join public.players p on p.id = m.player_id
        where sc.id = new.scheduled_challenge_id
          and private.publication_is_effectively_open(
            sc.status, s.status, s.starts_at, s.ends_at,
            sc.opens_at, sc.closes_at, new.started_at
          )
          and r.status = 'active'
          and m.status = 'active' and m.role in ('owner', 'admin', 'member')
          and p.status = 'active' and p.auth_user_id is not null
        for share of sc, s, r, m, p;
      if not found then raise exception 'No competitive access or publication unavailable'; end if;
    else
      if not exists (select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
        where x.player_id = new.player_id and p.status = 'active' and p.auth_user_id is not null) then
        raise exception 'Test attempts require a superadministrator';
      end if;
    end if;
    return new;
  end if;
  if (new.id, new.player_id, new.scheduled_challenge_id, new.challenge_version_id, new.kind,
      new.attempt_number, new.started_at) is distinct from
     (old.id, old.player_id, old.scheduled_challenge_id, old.challenge_version_id, old.kind,
      old.attempt_number, old.started_at) then
    raise exception 'Attempt context is immutable';
  end if;
  if new.deadline_at is distinct from old.deadline_at then
    if old.deadline_at is not null or old.status <> 'in_progress' or new.status <> 'in_progress'
      or not exists (
        select 1 from private.challenge_versions cv
        join private.attempt_timing_units u on u.attempt_id = old.id
        join private.challenge_items i on i.id = u.challenge_item_id
        where cv.id = old.challenge_version_id and cv.mode = 'time-trial'
          and i.position = 1 and u.scope = 'attempt'
          and u.deadline_at = new.deadline_at
          and u.deadline_at = u.started_at + cv.global_time_limit_ms * interval '1 millisecond'
          and (select count(*) from private.attempt_timing_units other_unit where other_unit.attempt_id = old.id) = 1
      ) then raise exception 'Attempt deadline is immutable'; end if;
  end if;
  if new.lock_version <> old.lock_version + 1 then raise exception 'Expected next lock_version'; end if;
  if old.status <> 'in_progress' then
    if new.status = old.status and (to_jsonb(new) - 'lock_version' - 'updated_at') =
      (to_jsonb(old) - 'lock_version' - 'updated_at') then return new; end if;
    if old.status not in ('completed', 'abandoned') or new.status <> 'invalidated'
      or (to_jsonb(new) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') <>
         (to_jsonb(old) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') then
      raise exception 'Terminal attempts cannot be replayed or overwritten';
    end if;
  elsif new.status = 'invalidated' then
    raise exception 'Complete or abandon before administrative invalidation';
  end if;
  if new.status = 'completed' then
    select cv.mode into attempt_mode from private.challenge_versions cv
      where cv.id = new.challenge_version_id;
    if attempt_mode is null
      or (attempt_mode in ('flash', 'alphabet', 'narrative', 'time-trial') and new.outcome is not null)
      or (attempt_mode = 'survival' and (new.outcome is null or new.outcome not in ('survived', 'eliminated')))
      or (attempt_mode = 'pyramid' and (new.outcome is null or new.outcome not in ('summit', 'failed'))) then
      raise exception 'invalid_attempt_lifecycle' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger attempts_guard before insert or update on public.attempts
  for each row execute function private.guard_attempt();
alter function private.guard_attempt() owner to postgres;
revoke all on function private.guard_attempt() from public, anon, authenticated, service_role;

create function private.reject_rewrite() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_user = 'postgres' then
    declare
      target text := nullif(current_setting('flash.purge_attempt_id', true), '');
      row_data jsonb := to_jsonb(old);
    begin
      if target is not null and (case tg_table_name
        when 'attempts' then row_data->>'id' = target
        when 'audit_log' then row_data->>'entity_type' = 'attempt' and row_data->>'entity_id' = target
        when 'command_requests' then row_data#>>'{input,attemptId}' = target
          or row_data#>>'{result,attemptId}' = target
        else row_data->>'attempt_id' = target
      end) then
        return old;
      end if;
    end;
  end if;
  raise exception 'Historical records cannot be overwritten or deleted';
end;
$$;
create trigger attempts_no_delete before delete on public.attempts
  for each row execute function private.reject_rewrite();
create trigger answers_append_only before update or delete on private.attempt_answers
  for each row execute function private.reject_rewrite();
create trigger entries_append_only before update or delete on private.flash_point_entries
  for each row execute function private.reject_rewrite();
create trigger attempt_answer_regrades_append_only before update or delete on private.attempt_answer_regrades
  for each row execute function private.reject_rewrite();
create trigger audit_append_only before update or delete on private.audit_log
  for each row execute function private.reject_rewrite();

create function private.guard_answer() returns trigger
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
  select i.points, cv.mode, cv.mode_config, i.question_version_id,
    cv.mode = 'pyramid' and q.type = 'connect-pairs'
      and coalesce(cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'queens'
      and coalesce(cv.mode_config->'queensTimeoutPartialCredit' = 'true'::jsonb, false),
    cv.mode = 'pyramid' and q.type = 'word-search'
      and coalesce(cv.mode_config->'wordSearchTimeoutPartialCredit' = 'true'::jsonb, false)
    into item_points, challenge_mode, challenge_config, question_version,
      pyramid_connect_pairs, pyramid_queens, pyramid_word_search
  from private.challenge_items i
  join private.challenge_versions cv on cv.id = i.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  where i.id = new.challenge_item_id;
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
create trigger answers_guard before insert on private.attempt_answers
  for each row execute function private.guard_answer();

create function private.guard_point_entry() returns trigger
language plpgsql set search_path = '' as $$
declare a public.attempts%rowtype; balance bigint; has_accreditation boolean;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.kind is distinct from 'competitive' then raise exception 'Only competitive attempts earn points'; end if;
  select coalesce(sum(amount), 0), coalesce(bool_or(entry_type = 'accreditation'), false)
    into balance, has_accreditation from private.flash_point_entries where attempt_id = new.attempt_id;
  if new.entry_type = 'accreditation' then
    if a.status <> 'completed' or new.amount <> a.score or has_accreditation
      or exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
      raise exception 'Invalid initial accreditation';
    end if;
  else
    if not has_accreditation or not exists (
      select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
      where x.player_id = new.created_by_player_id and p.status = 'active' and p.auth_user_id is not null
    ) then raise exception 'A correction requires accreditation and an active superadministrator'; end if;
    if new.entry_type in ('adjustment', 'answer_regrade') and (a.status <> 'completed' or exists (
      select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled'
    )) then raise exception 'Only eligible results may be adjusted'; end if;
  end if;
  if balance + new.amount not between 0 and 100 then raise exception 'Effective points must stay between 0 and 100'; end if;
  return new;
end;
$$;
create trigger entries_guard before insert on private.flash_point_entries
  for each row execute function private.guard_point_entry();

-- Server-maintained timestamps; order z_touch runs after the guards.
create trigger z_touch before update on public.players
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.rooms
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.room_memberships
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.seasons
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.scheduled_challenges
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.attempts
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.platform_role_assignments
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.room_invitations
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_definitions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_versions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_version_solutions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_definitions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_versions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_items
  for each row execute function private.touch_updated_at();

create trigger receipts_append_only before update or delete on private.answer_receipts
  for each row execute function private.reject_rewrite();
create trigger timing_units_immutable before update or delete on private.attempt_timing_units
  for each row execute function private.reject_rewrite();
create trigger requests_append_only before update or delete on private.command_requests
  for each row execute function private.reject_rewrite();
