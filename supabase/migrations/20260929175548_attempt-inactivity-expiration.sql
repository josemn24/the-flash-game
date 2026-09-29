SET local check_function_bodies = off;

DROP INDEX "private"."prepared_interactions_item_idx";

CREATE OR REPLACE FUNCTION private.execute_command (
  op    text,
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  received timestamptz := clock_timestamp();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  outcome jsonb;
  result jsonb;
  allowed text[];
  required text[];
begin
  case op
    when 'start' then
      allowed := array['idempotencyKey','scheduledChallengeId','sessionToken']; required := allowed;
    when 'takeover' then
      allowed := array['idempotencyKey','attemptId','lockVersion','newSessionToken']; required := allowed;
    when 'prepare' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'activate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'];
      allowed := required;
    when 'receive' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer'];
      allowed := required || array['clientTimeUsedMs'];
    when 'pass' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']; required := allowed;
    when 'evaluate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','receiptId','status','points'];
      allowed := required || array['resultDetails'];
    when 'complete' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','score'];
      allowed := required || array['outcome'];
    when 'abandon' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'accept_invitation' then
      allowed := array['idempotencyKey','invitationToken']; required := allowed;
    when 'invalidate' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason']; required := allowed;
    when 'adjust' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason','score']; required := allowed;
    else raise exception 'unknown_command' using errcode = '22023';
  end case;
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& required or exists (select 1 from jsonb_object_keys(input) k where not k = any(allowed))
    or exists (select 1 from unnest(required) k where k <> 'answer' and input->k = 'null'::jsonb) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  -- Never persist reusable secrets, including in idempotency records or audit payloads.
  if input ? 'sessionToken' then safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken'))); end if;
  if input ? 'newSessionToken' then safe_input := jsonb_set(safe_input, '{newSessionToken}', to_jsonb(private.secret_hash(input->>'newSessionToken'))); end if;
  if input ? 'invitationToken' then safe_input := jsonb_set(safe_input, '{invitationToken}', to_jsonb(private.secret_hash(input->>'invitationToken'))); end if;
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> op or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if op = 'accept_invitation' then
    outcome := private.handle_invitation_command(input, safe_input, actor, cached.result);
  else
    outcome := private.handle_attempt_command(op, input, safe_input, actor, cached.result, received);
  end if;
  result := outcome->'result';
  if coalesce((outcome->>'replayed')::boolean, false) then return result; end if;

  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, op, outcome->>'entityType', (outcome->>'entityId')::uuid, input->>'reason', key,
    nullif(outcome->'beforePayload', 'null'::jsonb),
    -- Avoid persisting playable payloads or free-text answers into a second store.
    result - 'publicPayload');
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, op, safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.expire_stale_attempts (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  run_id_value text;
  attempt_id_value uuid;
  room_slug_value text;
  now_value timestamptz;
  attempt_row public.attempts%rowtype;
  abandoned_count integer := 0;
  before_payload jsonb;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'attempt_expiration_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['runId','attemptId','roomSlug'])
    )
    or jsonb_typeof(input->'runId') is distinct from 'string'
    or (input ? 'attemptId' and jsonb_typeof(input->'attemptId') is distinct from 'string')
    or (input ? 'roomSlug' and jsonb_typeof(input->'roomSlug') is distinct from 'string')
    or (input ? 'attemptId' and input ? 'roomSlug') then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;

  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'attempt_expiration_invalid' using errcode = '22023';
  end if;
  if input ? 'attemptId' then
    begin
      attempt_id_value := (input->>'attemptId')::uuid;
    exception when others then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end;
  end if;
  if input ? 'roomSlug' then
    room_slug_value := btrim(input->>'roomSlug');
    if char_length(room_slug_value) = 0 or char_length(room_slug_value) > 160 then
      raise exception 'attempt_expiration_invalid' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  for attempt_row in
    select attempt.*
    from public.attempts attempt
    join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
    join public.seasons season on season.id = schedule.season_id
    join public.rooms room on room.id = season.room_id
    where attempt.kind = 'competitive'
      and attempt.status = 'in_progress'
      and coalesce(attempt.last_activity_at, attempt.started_at) <= now_value - interval '15 minutes'
      and (schedule.status = 'closed' or attempt.deadline_at <= now_value)
      and (attempt_id_value is null or attempt.id = attempt_id_value)
      and (room_slug_value is null or room.slug = room_slug_value)
    order by attempt.id
    for update of attempt skip locked
  loop
    before_payload := jsonb_build_object(
      'status', attempt_row.status,
      'lockVersion', attempt_row.lock_version,
      'score', attempt_row.score,
      'lastActivityAt', attempt_row.last_activity_at,
      'deadlineAt', attempt_row.deadline_at
    );

    update private.interaction_intervals interval_row
    set ended_at = greatest(interval_row.started_at, least(now_value, timing_unit.deadline_at)),
        end_reason = 'abandon'
    from private.attempt_timing_units timing_unit
    where interval_row.attempt_id = attempt_row.id
      and interval_row.ended_at is null
      and timing_unit.id = interval_row.timing_unit_id;

    delete from private.prepared_interactions where attempt_id = attempt_row.id;
    update public.attempts
    set status = 'abandoned',
        score = null,
        outcome = null,
        completed_at = now_value,
        progress_payload = null,
        terminal_reason = 'inactivity_timeout',
        lock_version = lock_version + 1
    where id = attempt_row.id
      and status = 'in_progress';
    if found then
      update private.attempt_sessions
      set revoked_at = now_value
      where attempt_id = attempt_row.id and revoked_at is null;

      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id,
        before_payload, after_payload
      ) values (
        null, 'expire_stale_attempt', 'attempt', attempt_row.id,
        '15 minutes without activity after challenge closure or deadline', run_id_value,
        before_payload,
        jsonb_build_object(
          'status', 'abandoned',
          'lockVersion', attempt_row.lock_version + 1,
          'score', null,
          'completedAt', now_value,
          'terminalReason', 'inactivity_timeout'
        )
      );
      abandoned_count := abandoned_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'runId', run_id_value,
    'evaluatedAt', now_value,
    'abandonedAttempts', abandoned_count
  );
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
    if cached_result is not null then return jsonb_build_object(
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
        if not found or (session_row.revoked_at is not null and not (
          op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')
        )) then raise exception 'session_revoked' using errcode = '42501'; end if;
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
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
          values(a.id, safe_input->>'newSessionToken', a.deadline_at) returning * into session_row;
        result := jsonb_build_object('sessionId', session_row.id, 'deadlineAt', a.deadline_at);
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
          else
            if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
              raise exception 'incomplete_challenge' using errcode = '55000';
            end if;
            points := (input->>'score')::integer;
            completion_outcome := input->>'outcome';
          end if;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        delete from private.prepared_interactions where attempt_id = a.id;
        update public.attempts set status = target_status, score = points, completed_at = instant,
          outcome = completion_outcome, progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        if op = 'complete' then
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
        end if;
        result := jsonb_build_object('status', a.status, 'score', a.score,
          'outcome', a.outcome,
          'livesRemaining', case when cv.mode = 'survival' then survival_lives else null end);
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

CREATE OR REPLACE FUNCTION private.prepare_interaction (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  mode text;
  key text := input->>'idempotencyKey';
  had_open boolean;
  segment private.interaction_intervals%rowtype;
  result jsonb;
begin
  select cv.mode into mode
  from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = (input->>'attemptId')::uuid;
  if mode <> 'pyramid' then
    return private.execute_command('prepare', input);
  end if;

  select exists (
    select 1 from private.interaction_intervals
    where attempt_id = (input->>'attemptId')::uuid and ended_at is null
  ) into had_open;
  result := private.execute_command('prepare', input);

  -- The current declarative handler already creates a prepared row. This
  -- branch is only needed when a deployment runs this wrapper over the older
  -- handler that started the clock during prepare.
  if result->>'deadlineAt' is not null and not had_open then
    select * into segment from private.interaction_intervals
    where attempt_id = (input->>'attemptId')::uuid and ended_at is null
    for update;
    if found then
      insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
      select segment.attempt_id, unit.challenge_version_id, segment.challenge_item_id
      from private.attempt_timing_units unit
      where unit.id = segment.timing_unit_id
      on conflict (attempt_id) do nothing;
      delete from private.interaction_intervals where id = segment.id;
      delete from private.attempt_timing_units where id = segment.timing_unit_id;
    else
      insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
      select (input->>'attemptId')::uuid, a.challenge_version_id, (result->>'challengeItemId')::uuid
      from public.attempts a where a.id = (input->>'attemptId')::uuid
      on conflict (attempt_id) do nothing;
    end if;
    result := jsonb_set(result, '{presentedAt}', 'null'::jsonb, true);
    result := jsonb_set(result, '{deadlineAt}', 'null'::jsonb, true);
    result := jsonb_set(result, '{timedOut}', 'false'::jsonb, true);
    update private.command_requests
    set result = prepare_interaction.result
    where actor_id = actor and idempotency_key = key and operation = 'prepare';
  end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.queens_cell_conflicts (
  regions     jsonb,
  target_cell integer,
  queens      integer[]
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  cell_count integer := jsonb_array_length(regions);
  board_size integer;
begin
  if cell_count is null or cell_count = 0 then return false; end if;
  board_size := sqrt(cell_count::numeric)::integer;
  if board_size * board_size <> cell_count or target_cell not between 0 and cell_count - 1 then return false; end if;
  return exists (
    select 1
    from unnest(queens) cell
    where cell <> target_cell
      and (
        target_cell / board_size = cell / board_size
        or target_cell % board_size = cell % board_size
        or regions->target_cell = regions->cell
        or greatest(
          abs(target_cell / board_size - cell / board_size),
          abs(target_cell % board_size - cell % board_size)
        ) = 1
      )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.queens_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  board_size integer;
  cell_count integer;
  regions integer[] := '{}';
  prefilled integer[] := '{}';
  solution integer[] := '{}';
  value text;
  cell integer;
  index integer;
  solution_count integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
    or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
    or jsonb_typeof(public_payload->'regions') is distinct from 'array'
    or jsonb_typeof(public_payload->'prefilledQueens') is distinct from 'array'
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
  then
    return false;
  end if;

  board_size := (public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (public_payload->'grid'->>'columns')::integer <> board_size then
    return false;
  end if;
  cell_count := board_size * board_size;
  if jsonb_array_length(public_payload->'regions') <> cell_count
    or jsonb_array_length(solution_payload->'solution') <> board_size then
    return false;
  end if;

  if exists (
    select 1 from jsonb_array_elements(public_payload->'regions') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) or exists (
    select 1 from jsonb_array_elements(public_payload->'prefilledQueens') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) or exists (
    select 1 from jsonb_array_elements(solution_payload->'solution') entry
    where jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
  ) then
    return false;
  end if;

  for value in select jsonb_array_elements_text(public_payload->'regions') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and board_size - 1 then return false; end if;
    regions := regions || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(public_payload->'prefilledQueens') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and cell_count - 1 then return false; end if;
    prefilled := prefilled || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(solution_payload->'solution') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and cell_count - 1 then return false; end if;
    solution := solution || value::integer;
  end loop;

  for index in 0..(board_size - 1) loop
    if not exists (select 1 from unnest(regions) as region_cell where region_cell = index) then return false; end if;
    if (
      with recursive walk(cell) as (
        (select min(candidate)::integer
         from generate_series(0, cell_count - 1) candidate
         where regions[candidate + 1] = index)
        union
        select neighbour
        from walk
        cross join lateral (
          select (walk.cell / board_size - 1) * board_size + walk.cell % board_size as neighbour
          where walk.cell / board_size > 0
          union all
          select (walk.cell / board_size + 1) * board_size + walk.cell % board_size
          where walk.cell / board_size < board_size - 1
          union all
          select (walk.cell / board_size) * board_size + walk.cell % board_size - 1
          where walk.cell % board_size > 0
          union all
          select (walk.cell / board_size) * board_size + walk.cell % board_size + 1
          where walk.cell % board_size < board_size - 1
        ) neighbours
        where regions[neighbour + 1] = index
      )
      select count(*) from walk
    ) <> (select count(*) from unnest(regions) as region_cell where region_cell = index) then
      return false;
    end if;
  end loop;

  if (select count(distinct solution_cell) from unnest(solution) as solution_cell) <> coalesce(array_length(solution, 1), 0)
    or (select count(distinct prefilled_cell) from unnest(prefilled) as prefilled_cell) <> coalesce(array_length(prefilled, 1), 0)
    or exists (select 1 from unnest(prefilled) as prefilled_cell where not prefilled_cell = any(solution)) then
    return false;
  end if;

  if exists (
    select 1 from unnest(solution) as left_cell cross join unnest(solution) as right_cell
    where left_cell < right_cell
      and (left_cell / board_size = right_cell / board_size
        or left_cell % board_size = right_cell % board_size
        or regions[left_cell + 1] = regions[right_cell + 1]
        or greatest(abs(left_cell / board_size - right_cell / board_size), abs(left_cell % board_size - right_cell % board_size)) = 1)
  ) then
    return false;
  end if;

  for index in 0..(board_size - 1) loop
    if (select count(*) from unnest(solution) as solution_cell where solution_cell / board_size = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where solution_cell % board_size = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where regions[solution_cell + 1] = index) <> 1 then
      return false;
    end if;
  end loop;

  with recursive search(row_no, previous_column, used_columns, used_regions) as (
    select 0, null::integer, '{}'::integer[], '{}'::integer[]
    union all
    select search.row_no + 1,
      candidate,
      search.used_columns || candidate,
      search.used_regions || regions[search.row_no * board_size + candidate + 1]
    from search
    cross join generate_series(0, board_size - 1) candidate
    where search.row_no < board_size
      and not candidate = any(search.used_columns)
      and not regions[search.row_no * board_size + candidate + 1] = any(search.used_regions)
      and (search.previous_column is null or abs(search.previous_column - candidate) > 1)
  )
  select count(*)::integer into solution_count
  from (select 1 from search where row_no = board_size limit 2) bounded_solutions;
  return solution_count = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION private.queens_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  regions jsonb;
  draft jsonb;
  queens integer[];
  board_size integer;
  conflicting_queens integer;
  completed_rows integer;
  completed_columns integer;
  completed_regions integer;
  solved boolean;
begin
  select q.public_payload->'regions', (q.public_payload->'grid'->>'rows')::integer, a.progress_payload
    into regions, board_size, draft
  from public.attempts a
  join private.challenge_items i on i.id = target_item
  join private.question_versions q on q.id = i.question_version_id
  where a.id = target_attempt;

  if jsonb_typeof(draft) = 'object'
    and draft->>'kind' = 'queens'
    and (draft->>'challengeItemId')::uuid = target_item
    and jsonb_typeof(draft->'queens') = 'array' then
    select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
      into queens
    from jsonb_array_elements_text(draft->'queens') value;
  else
    queens := private.queens_board(target_attempt, target_item);
  end if;

  with pairs as (
    select left_cell as cell, right_cell
    from unnest(queens) left_cell
    cross join unnest(queens) right_cell
    where left_cell < right_cell
  ), conflicts as (
    select p.cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
    union
    select p.right_cell
    from pairs p
    where p.cell / board_size = p.right_cell / board_size
       or p.cell % board_size = p.right_cell % board_size
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / board_size - p.right_cell / board_size), abs(p.cell % board_size - p.right_cell % board_size)) = 1
  )
  select count(*)::integer into conflicting_queens from conflicts;

  select count(*)::integer into completed_rows
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell / board_size = group_no) = 1;
  select count(*)::integer into completed_columns
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where cell % board_size = group_no) = 1;
  select count(*)::integer into completed_regions
  from generate_series(0, board_size - 1) group_no
  where (select count(*) from unnest(queens) cell where (regions->cell)::integer = group_no) = 1;

  solved := coalesce(array_length(queens, 1), 0) = board_size
    and completed_rows = board_size
    and completed_columns = board_size
    and completed_regions = board_size
    and conflicting_queens = 0;

  return jsonb_build_object(
    'kind', 'queens',
    'queens', to_jsonb(queens),
    'placedQueens', coalesce(array_length(queens, 1), 0),
    'completedRows', completed_rows,
    'completedColumns', completed_columns,
    'completedRegions', completed_regions,
    'conflictingQueens', conflicting_queens,
    'solved', solved
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.run_calendar_tick_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  run_id_value text;
  now_value timestamptz;
  room_id_value uuid;
  schedule_row public.scheduled_challenges%rowtype;
  season_row public.seasons%rowtype;
  opened_count integer := 0;
  closed_count integer := 0;
  finished_count integer := 0;
  abandoned_count integer := 0;
  expiration_result jsonb;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'calendar_tick_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> 'runId')
    or jsonb_typeof(input->'runId') is distinct from 'string' then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;
  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  -- Administrative commands and the tick always acquire room, then season,
  -- then publication locks. This avoids cross-slice deadlocks.
  for room_id_value in
    select distinct season.room_id
    from public.seasons season
    left join public.scheduled_challenges schedule on schedule.season_id = season.id
    where (season.status = 'active' and season.ends_at <= now_value)
       or (schedule.status in ('scheduled', 'open') and schedule.closes_at <= now_value)
    order by season.room_id
  loop
    perform 1 from public.rooms room where room.id = room_id_value for update;
  end loop;

  for season_row in
    select season.*
    from public.seasons season
    where (season.status = 'active' and season.ends_at <= now_value)
       or exists (
         select 1 from public.scheduled_challenges schedule
         where schedule.season_id = season.id
           and schedule.status in ('scheduled', 'open')
           and schedule.closes_at <= now_value
       )
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status in ('scheduled', 'open')
      and schedule.closes_at <= now_value
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'closed'
    where id = schedule_row.id and status in ('scheduled', 'open') and closes_at <= now_value;
    if found then
      closed_count := closed_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'close_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', schedule_row.status), jsonb_build_object('status', 'closed')
      );
    end if;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status = 'scheduled'
      and schedule.opens_at <= now_value and now_value < schedule.closes_at
      and season.status = 'active'
      and season.starts_at <= now_value and now_value < season.ends_at
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'open'
    where id = schedule_row.id and status = 'scheduled'
      and opens_at <= now_value and now_value < closes_at;
    if found then
      opened_count := opened_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'open_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'scheduled'), jsonb_build_object('status', 'open')
      );
    end if;
  end loop;

  for season_row in
    select season.* from public.seasons season
    where season.status = 'active' and season.ends_at <= now_value
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
    update public.seasons set status = 'finished'
    where id = season_row.id and status = 'active' and ends_at <= now_value;
    if found then
      finished_count := finished_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'finish_season', 'season', season_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'active'), jsonb_build_object('status', 'finished')
      );
    end if;
  end loop;

  select private.expire_stale_attempts(jsonb_build_object('runId', run_id_value))
    into expiration_result;
  abandoned_count := (expiration_result->>'abandonedAttempts')::integer;

  return jsonb_build_object(
    'runId', run_id_value, 'evaluatedAt', now_value,
    'opened', opened_count, 'closed', closed_count, 'finishedSeasons', finished_count,
    'abandonedAttempts', abandoned_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.save_queens_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_queens_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) > board_size then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id, 'queens', to_jsonb(normalized)),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  progress := private.queens_progress(a.id, item.id);
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_queens_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_queens_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_queens_answer (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  validation private.queens_validation_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  candidate integer[];
  prefilled integer[];
  normalized integer[];
  solution integer[];
  board_size integer;
  cell_count integer;
  progress jsonb;
  correct boolean;
  sequence_no integer;
  incorrect_attempts integer;
  penalty_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','queens'
    ]))
    or jsonb_typeof(input->'queens') is distinct from 'array'
    or jsonb_array_length(input->'queens') > 64
    or exists (
      select 1 from jsonb_array_elements(input->'queens') value
      where jsonb_typeof(value) is distinct from 'number'
        or (value #>> '{}')::numeric <> trunc((value #>> '{}')::numeric)
        or (value #>> '{}')::integer not between 0 and 63
    ) then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into candidate from jsonb_array_elements_text(input->'queens') value;
  if (select count(*) from unnest(candidate)) <> (select count(distinct cell) from unnest(candidate) cell) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_answer' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  board_size := (question.public_payload->'grid'->>'rows')::integer;
  if board_size not between 4 and 8
    or (question.public_payload->'grid'->>'columns')::integer <> board_size then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  cell_count := board_size * board_size;
  if coalesce(array_length(candidate, 1), 0) <> board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(candidate) cell where cell not between 0 and cell_count - 1) then
    raise exception 'invalid_queens_answer' using errcode = '22023';
  end if;

  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into prefilled from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value;
  select coalesce(array_agg(cell order by cell), '{}'::integer[]) into normalized
  from (
    select distinct cell from unnest(candidate) cell
    union
    select distinct cell from unnest(prefilled) cell
  ) cells;
  if coalesce(array_length(normalized, 1), 0) <> board_size then
    raise exception 'queens_answer_incomplete' using errcode = '22023';
  end if;
  select coalesce(array_agg(value::integer order by value::integer), '{}'::integer[])
    into solution
  from private.question_version_solutions qs
  cross join jsonb_array_elements_text(qs.solution_payload->'solution') value
  where qs.question_version_id = question.id;
  update public.attempts
    set progress_payload = jsonb_build_object('kind', 'queens', 'challengeItemId', item.id, 'queens', to_jsonb(normalized)),
        lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id;
  progress := private.queens_progress(a.id, item.id);
  correct := (progress->>'solved')::boolean and normalized = solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_validation_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  penalty_points := case when correct then 0 else round(item.points * 0.05)::integer end;
  insert into private.queens_validation_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, queens, correct,
    conflicting_queens, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized, correct,
    (progress->>'conflictingQueens')::integer, not correct, penalty_points,
    instant, presented, used_ms, key)
  returning * into validation;
  if correct then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  select count(*)::integer into incorrect_attempts
    from private.queens_validation_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'correct', correct, 'terminal', correct, 'queens', progress->'queens',
    'placedQueens', progress->'placedQueens', 'completedRows', progress->'completedRows',
    'completedColumns', progress->'completedColumns', 'completedRegions', progress->'completedRegions',
    'conflictingQueens', progress->'conflictingQueens', 'solved', progress->'solved',
    'incorrectAttempts', incorrect_attempts);
  if correct then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_answer', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'queens', to_jsonb(normalized)),
      jsonb_build_object('lockVersion', a.lock_version, 'correct', correct, 'incorrectAttempts', incorrect_attempts));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_answer', safe_input, result);
  return result;
end;
$function$;

CREATE INDEX prepared_item_idx ON private.prepared_interactions USING btree (challenge_item_id, challenge_version_id);

CREATE INDEX attempts_inactivity_candidates_idx ON public.attempts USING btree (last_activity_at, started_at, scheduled_challenge_id)
  WHERE ((kind = 'competitive'::text) AND (status = 'in_progress'::text));

REVOKE ALL ON FUNCTION "private"."expire_stale_attempts"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."expire_stale_attempts"(jsonb) TO "postgres", "service_role";
