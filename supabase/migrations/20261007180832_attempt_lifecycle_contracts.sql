-- Canonical attempt lifecycle contracts. Apply on the agreed clean database.
-- Generated with supabase db schema declarative sync; unrelated pre-existing drift omitted.
begin;
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guard_attempt()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
      new.attempt_number, new.started_at, new.deadline_at) is distinct from
     (old.id, old.player_id, old.scheduled_challenge_id, old.challenge_version_id, old.kind,
      old.attempt_number, old.started_at, old.deadline_at) then
    raise exception 'Attempt context is immutable';
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
      or (attempt_mode in ('flash', 'alphabet', 'narrative') and new.outcome is not null)
      or (attempt_mode = 'survival' and (new.outcome is null or new.outcome not in ('survived', 'eliminated')))
      or (attempt_mode = 'pyramid' and (new.outcome is null or new.outcome not in ('summit', 'failed'))) then
      raise exception 'invalid_attempt_lifecycle' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_command (
  op            text,
  input         jsonb,
  safe_input    jsonb,
  actor         uuid,
  cached_result jsonb,
  received_at   timestamp with time zone
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  unit private.attempt_timing_units%rowtype;
  segment private.interaction_intervals%rowtype;
  prepared private.prepared_interactions%rowtype;
  receipt private.answer_receipts%rowtype;
  session_row private.attempt_sessions%rowtype;
  item private.challenge_items%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  points integer;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  resumed boolean := false;
  control_required boolean := false;
  is_admin boolean;
  clear_progress boolean := false;
  target_status text;
  completion_outcome text;
  survival_lives integer;
  survival_mistakes integer;
  survival_resolved integer;
  survival_total integer;
  pyramid_resolved integer;
  pyramid_total integer;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'start' then
    target := (input->>'scheduledChallengeId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
    if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = target for share;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
    if cached_result is not null then
      perform private.authorize_attempt_replay(a.id, safe_input->>'sessionToken');
      return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    if found then
      if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
      resumed := true;
      select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
      control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
    else
      insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
      values(actor, target, sc.challenge_version_id, 'competitive', 1)
      returning * into a;
      insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
        values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
    end if;
    target := a.id;
    result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
      'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op = 'takeover' and a.scheduled_challenge_id <> (input->>'scheduledChallengeId')::uuid then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if op not in ('invalidate','adjust') then
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
    if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
    if op not in ('invalidate','adjust') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        if a.deadline_at is not null and instant >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
        update private.attempt_sessions
        set revoked_at = instant, revocation_reason = 'takeover'
        where attempt_id = a.id and revoked_at is null;
        insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
          values(a.id, safe_input->>'newSessionToken', a.deadline_at) returning * into session_row;
        result := jsonb_build_object(
          'attemptId', a.id,
          'sessionId', session_row.id,
          'lockVersion', a.lock_version,
          'deadlineAt', a.deadline_at,
          'transferred', true
        );
      when 'prepare' then
        if cv.mode = 'pyramid' and exists (
          select 1 from private.attempt_answers answer
          where answer.attempt_id = a.id and answer.status <> 'correct'
        ) then
          raise exception 'pyramid_level_failed' using errcode = '55000';
        end if;
        if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id and not exists (
          select 1 from private.attempt_answers aa where aa.receipt_id = r.id
        )) then raise exception 'evaluation_pending' using errcode = '55000'; end if;
        if cv.mode = 'pyramid' then
          select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
          if found then
            select * into item from private.challenge_items where id = segment.challenge_item_id;
            select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
          else
            select * into prepared from private.prepared_interactions where attempt_id = a.id for update;
            if found then
              select * into item from private.challenge_items where id = prepared.challenge_item_id;
            else
              select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
              if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
              insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
                values(a.id, a.challenge_version_id, item.id);
            end if;
          end if;
        else
          select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
          if found then
            select * into item from private.challenge_items where id = segment.challenge_item_id;
            select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
          else
            select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
            if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
            select * into unit from private.attempt_timing_units where attempt_id = a.id and challenge_item_id = item.id;
            if not found then
              insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
              select a.id, a.challenge_version_id, item.id,
                case cv.mode when 'alphabet' then 'attempt' else 'question' end,
                case when cv.mode = 'alphabet' then a.started_at else instant end,
                case when cv.mode = 'alphabet' then a.deadline_at else instant + q.time_limit_ms * interval '1 millisecond' end
              from private.question_versions q where q.id = item.question_version_id returning * into unit;
            end if;
            insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
              values(a.id, item.id, unit.id, least(instant, unit.deadline_at)) returning * into segment;
          end if;
        end if;
        perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
        select jsonb_build_object('challengeItemId', item.id, 'questionType', q.type,
          'payloadSchemaVersion', q.payload_schema_version,
          'publicPayload', case
            when (cv.mode <> 'pyramid' or segment.id is not null) and instant >= unit.deadline_at then null
            when q.type = 'progressive-clues' then private.progressive_clues_public_payload(item.id)
            when q.type = 'matching' then private.matching_public_payload(item.id)
            else q.public_payload
          end,
          'presentedAt', case when segment.id is null then null else segment.started_at end,
          'deadlineAt', case when segment.id is null then null else unit.deadline_at end,
          'timedOut', case when segment.id is null then false else instant >= unit.deadline_at end,
          'progress', case
            when q.type = 'mini-wordle' then private.mini_wordle_progress(a.id, item.id)
            when q.type = 'logic-code' then private.logic_code_progress(a.id, item.id)
            when q.type = 'progressive-clues' then private.progressive_clues_progress(a.id, item.id)
            when q.type = 'queens' then private.queens_progress(a.id, item.id)
            when q.type = 'word-search' then private.word_search_progress(a.id, item.id)
            when q.type = 'word-hashtag' then private.word_hashtag_progress(a.id, item.id) - 'solved'
            when q.type = 'short-text' and cv.mode = 'alphabet' then (
              select jsonb_build_object(
                'kind', 'alphabet',
                'round', greatest(1, 1 + floor((
                  (select count(*) from private.interaction_intervals interval_row
                    where interval_row.attempt_id = a.id)::numeric /
                  nullif((select count(*) from private.challenge_items round_item
                    where round_item.challenge_version_id = a.challenge_version_id)::numeric, 0)
                ))::integer),
                'currentIndex', item.position - 1,
                'playedCount', (select count(distinct interval_row.challenge_item_id)::integer
                  from private.interaction_intervals interval_row
                  where interval_row.attempt_id = a.id),
                'correctAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'incorrectAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'incorrect'),
                'elapsedTimeMs', coalesce((select sum(floor(extract(epoch from
                  (interval_row.ended_at - interval_row.started_at)) * 1000))::bigint
                  from private.interaction_intervals interval_row where interval_row.attempt_id = a.id), 0)::bigint,
                'deadlineAt', a.deadline_at,
                'lastCorrectAt', (select max(answer_row.submitted_at) from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'letters', coalesce((select jsonb_agg(jsonb_build_object(
                  'letter', all_item.mode_config->>'letter',
                  'challengeItemId', all_item.id,
                  'status', case
                    when answer_row.status is not null then answer_row.status
                    when exists (select 1 from private.interaction_intervals open_interval
                      where open_interval.attempt_id = a.id and open_interval.challenge_item_id = all_item.id
                        and open_interval.ended_at is null) then 'active'
                    when exists (select 1 from private.interaction_intervals visited
                      where visited.attempt_id = a.id and visited.challenge_item_id = all_item.id) then 'passed'
                    else 'unvisited' end,
                  'answer', case when answer_row.answer is null then null
                    else answer_row.answer #>> '{}' end
                ) order by all_item.position)
                  from private.challenge_items all_item
                  left join private.attempt_answers answer_row
                    on answer_row.attempt_id = a.id and answer_row.challenge_item_id = all_item.id
                  where all_item.challenge_version_id = a.challenge_version_id), '[]'::jsonb)
              )
            )
            else null end)
          into result from private.question_versions q where q.id = item.question_version_id;
      when 'activate' then
        if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
        select * into segment from private.interaction_intervals
          where attempt_id = a.id and ended_at is null for update;
        if found then
          if segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
            raise exception 'interaction_not_presented' using errcode = '55000';
          end if;
          select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        else
          select * into prepared from private.prepared_interactions
            where attempt_id = a.id and challenge_item_id = (input->>'challengeItemId')::uuid for update;
          if not found then raise exception 'interaction_not_presented' using errcode = '55000'; end if;
          select * into item from private.challenge_items where id = prepared.challenge_item_id;
          insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id,
            scope, started_at, deadline_at)
          select a.id, a.challenge_version_id, item.id, 'level', instant,
            instant + q.time_limit_ms * interval '1 millisecond'
          from private.question_versions q where q.id = item.question_version_id
          returning * into unit;
          insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
            values(a.id, item.id, unit.id, instant) returning * into segment;
          delete from private.prepared_interactions where attempt_id = a.id;
        end if;
        result := jsonb_build_object(
          'challengeItemId', segment.challenge_item_id,
          'presentedAt', segment.started_at,
          'deadlineAt', unit.deadline_at,
          'timedOut', instant >= unit.deadline_at);
      when 'receive', 'pass' then
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
          raise exception 'interaction_not_presented' using errcode = '55000';
        end if;
        select * into item from private.challenge_items where id = segment.challenge_item_id;
        select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'matching'
        ) and (
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
            case when input->'answer' = 'null'::jsonb and exists (
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
      when 'evaluate' then
        select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
          raise exception 'already_evaluated' using errcode = '55000';
        end if;
        -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
          status, answer, result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
          input->>'status', receipt.answer, input->'resultDetails',
          case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
        result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status',
          'points', case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end);
      when 'complete', 'abandon' then
        if op = 'complete' then
          if cv.mode = 'alphabet' then
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
              insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id,
                receipt_id, status, answer, result_details, points, presented_at, submitted_at,
                time_used_ms, idempotency_key)
              values(a.id, receipt.challenge_item_id, a.challenge_version_id, receipt.id,
                input->'pendingEvaluation'->>'status', receipt.answer,
                input->'pendingEvaluation'->'resultDetails', (input->'pendingEvaluation'->>'points')::integer,
                receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms,
                'complete:evaluation:' || receipt.id);
            end if;
            if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
              and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
              raise exception 'unfinished_interaction' using errcode = '55000';
            end if;
            if private.next_attempt_item(a.id) is not null then
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
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
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
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
          elsif cv.mode = 'alphabet' then
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
            completion_outcome := null;
          else
            if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
              raise exception 'incomplete_challenge' using errcode = '55000';
            end if;
            points := (input->>'score')::integer;
            completion_outcome := null;
          end if;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null; completion_outcome := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        delete from private.prepared_interactions where attempt_id = a.id;
        update public.attempts set status = target_status, score = points, completed_at = instant,
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
        if op = 'complete' and cv.mode = 'alphabet' then
          result := result || jsonb_build_object('answers', coalesce((
            select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
              'answer', aa.answer, 'status', aa.status, 'points', aa.points,
              'timeUsedMs', aa.time_used_ms, 'resultDetails', aa.result_details) order by ci.position)
            from private.attempt_answers aa join private.challenge_items ci on ci.id = aa.challenge_item_id
            where aa.attempt_id = a.id
          ), '[]'::jsonb));
        end if;
      when 'invalidate', 'adjust' then
        result := private.handle_attempt_admin_command(op, input, actor, a, sc, instant, key);
        select * into a from public.attempts where id = a.id;
    end case;
    if op not in ('complete','abandon','invalidate','adjust') then
      update public.attempts
        set lock_version = lock_version + 1,
            last_activity_at = instant,
            progress_payload = case when clear_progress then null else progress_payload end
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  end if;

  return jsonb_build_object(
    'result', result,
    'entityType', 'attempt',
    'entityId', a.id,
    'beforePayload', previous,
    'replayed', false
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_abandoned_attempt (
  target_attempt uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'scheduledChallengeId', a.scheduled_challenge_id,
    'result', coalesce(command.result, jsonb_strip_nulls(jsonb_build_object(
      'attemptId', a.id,
      'lockVersion', a.lock_version,
      'status', a.status,
      'score', a.score,
      'outcome', a.outcome,
      'terminalReason', a.terminal_reason,
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'challengeItemId', answer.challenge_item_id,
          'answer', answer.answer,
          'status', answer.status,
          'points', answer.points,
          'timeUsedMs', answer.time_used_ms,
          'resultDetails', answer.result_details
        ) order by item.position)
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id
      ), '[]'::jsonb)
    ))) || jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome, 'score', a.score)
  )
  from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  left join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  left join private.command_requests command on command.actor_id = a.player_id
    and command.operation = 'abandon' and command.input->>'attemptId' = a.id::text
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'abandoned'
    and sc.status <> 'cancelled' and room.status = 'active'
    and (
      (a.terminal_reason = 'permission_revoked')
      or (
        command.result->>'status' = 'abandoned'
        and m.status = 'active' and m.role in ('owner','admin','member')
      )
    )
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$function$;

CREATE OR REPLACE FUNCTION private.read_attempt_recovery (
  target_attempt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status, 'outcome', a.outcome,
    'lockVersion', a.lock_version,
    'deadlineAt', a.deadline_at,
    'deadlineReached', a.deadline_at is not null and clock_timestamp() >= a.deadline_at,
    'pendingReceiptId', (select receipt.id from private.answer_receipts receipt
      where receipt.attempt_id = a.id and not exists (
        select 1 from private.attempt_answers answer where answer.receipt_id = receipt.id
      ) order by receipt.received_at, receipt.id limit 1),
    'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'hasOpenInteraction', exists (select 1 from private.interaction_intervals interval_row
      where interval_row.attempt_id = a.id and interval_row.ended_at is null),
    'narrativeCursor', case when cv.mode = 'narrative' then jsonb_build_object(
      'currentChallengeItemId', (select interval_row.challenge_item_id
        from private.interaction_intervals interval_row
        where interval_row.attempt_id = a.id and interval_row.ended_at is null
        order by interval_row.started_at desc limit 1),
      'nextChallengeItemId', (select item.id
        from private.challenge_items item
        where item.challenge_version_id = a.challenge_version_id
          and not exists (select 1 from private.attempt_answers answer
            where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
        order by item.position limit 1)
    ) else null end,
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id
      and not exists (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'challengeMode', cv.mode,
    'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer else null end,
    'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
      select sum(case
        when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
        when question.type = 'queens'
          and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
        else 0 end)::integer
      from private.attempt_answers answer
      join private.challenge_items item on item.id = answer.challenge_item_id
      join private.question_versions question on question.id = item.question_version_id
      where answer.attempt_id = a.id
    ), 0), 0) else null end,
    'terminalOutcome', case when cv.mode = 'survival' and (
      greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when question.type = 'queens'
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions question on question.id = item.question_version_id
        where answer.attempt_id = a.id
      ), 0), 0) = 0
    ) then 'eliminated' when cv.mode = 'survival' and not exists (
      select 1 from private.challenge_items item where item.challenge_version_id = a.challenge_version_id
        and not exists (select 1 from private.attempt_answers answer where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
    ) then 'survived'
      when cv.mode = 'pyramid' and exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then 'failed'
      when cv.mode = 'pyramid' and (
        select count(*) from private.attempt_answers answer where answer.attempt_id = a.id
      ) = 7 then 'summit'
      else null end,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
      'status', aa.status, 'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms,
      'resultDetails', aa.result_details) order by i.position)
      from private.attempt_answers aa join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)
  ) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive'
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_completed_attempt (
  target_attempt uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('scheduledChallengeId', sc.id, 'result',
    jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
      'status', a.status, 'score', a.score, 'outcome', a.outcome,
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
        'timeUsedMs', answer.time_used_ms, 'resultDetails', answer.result_details) order by item.position)
        from private.attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id), '[]'::jsonb))) ||
      jsonb_build_object('challengeMode', cv.mode, 'outcome', a.outcome))
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
$function$;

ALTER TABLE "public"."attempts"
  ADD CONSTRAINT "attempts_outcome_status_check" CHECK (((status <> ALL (ARRAY['in_progress'::text, 'abandoned'::text])) OR (outcome IS NULL)));


ALTER TABLE "public"."attempts"
  ADD CONSTRAINT "attempts_outcome_values_check" CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['survived'::text, 'eliminated'::text, 'summit'::text, 'failed'::text]))));

commit;
