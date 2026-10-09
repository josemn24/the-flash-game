-- Reconcile competitive command behavior after the validator refactor.
-- Replace the dispatcher before the facade; preserve function OIDs and ACLs.
-- This migration changes function bodies only and never rewrites existing rows.
begin;

SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.activate_interaction (
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
  sc public.scheduled_challenges%rowtype;
  cv private.challenge_versions%rowtype;
  session_row private.attempt_sessions%rowtype;
  prepared private.prepared_interactions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests
  where actor_id = actor and idempotency_key = key;
  if found then
    if cached.operation <> 'activate' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
  select * into cv from private.challenge_versions where id = a.challenge_version_id;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor)
    or not exists (
      select 1 from public.seasons s
      join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
  where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
  if sc.status = 'cancelled' then raise exception 'publication_cancelled' using errcode = '55000'; end if;

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
    insert into private.attempt_timing_units(
      attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
    select a.id, a.challenge_version_id, item.id, 'level', instant,
      instant + q.time_limit_ms * interval '1 millisecond'
    from private.question_versions q where q.id = item.question_version_id
    returning * into unit;
    insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
      values(a.id, item.id, unit.id, instant) returning * into segment;
    delete from private.prepared_interactions where attempt_id = a.id;
  end if;

  update public.attempts
  set lock_version = lock_version + 1, last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'lockVersion', a.lock_version,
    'challengeItemId', segment.challenge_item_id,
    'presentedAt', segment.started_at,
    'deadlineAt', unit.deadline_at,
    'timedOut', instant >= unit.deadline_at);
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
  values(actor, 'activate', 'attempt', a.id, key,
    jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'activate', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.close_attempt_as_abandoned (
  target_attempt        uuid,
  closed_at             timestamp with time zone,
  terminal_reason_value text,
  audit_actor           uuid,
  audit_request_id      text,
  audit_reason          text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  attempt_row public.attempts%rowtype;
  before_payload jsonb;
begin
  if terminal_reason_value not in ('abandon', 'inactivity_timeout', 'permission_revoked')
    or closed_at is null
    or audit_request_id is null then
    raise exception 'invalid_attempt_closure' using errcode = '22023';
  end if;

  select * into attempt_row
  from public.attempts
  where id = target_attempt
  for update;

  if not found or attempt_row.kind <> 'competitive' or attempt_row.status <> 'in_progress' then
    return false;
  end if;

  before_payload := jsonb_build_object(
    'status', attempt_row.status,
    'lockVersion', attempt_row.lock_version,
    'score', attempt_row.score,
    'lastActivityAt', attempt_row.last_activity_at,
    'deadlineAt', attempt_row.deadline_at
  );

  update private.interaction_intervals interval_row
  set ended_at = greatest(interval_row.started_at, least(closed_at, timing_unit.deadline_at)),
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
      completed_at = closed_at,
      progress_payload = null,
      terminal_reason = terminal_reason_value,
      lock_version = lock_version + 1
  where id = attempt_row.id and status = 'in_progress'
  returning * into attempt_row;

  if not found then return false; end if;

  update private.attempt_sessions
  set revoked_at = closed_at,
      revocation_reason = case when terminal_reason_value = 'permission_revoked'
        then 'permission_revoked' else 'terminal' end
  where attempt_id = attempt_row.id and revoked_at is null;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    audit_actor,
    case when terminal_reason_value = 'inactivity_timeout'
      then 'expire_stale_attempt'
      else 'close_attempt_' || terminal_reason_value
    end,
    'attempt', attempt_row.id,
    audit_reason, audit_request_id, before_payload,
    jsonb_build_object(
      'status', 'abandoned',
      'lockVersion', attempt_row.lock_version,
      'score', null,
      'completedAt', closed_at,
      'terminalReason', terminal_reason_value
    )
  );
  return true;
end;
$function$;

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
      allowed := array['idempotencyKey','attemptId','scheduledChallengeId','lockVersion','newSessionToken']; required := allowed;
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
      allowed := required || array['outcome','pendingEvaluation'];
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
  values(actor, case when op = 'takeover' then 'takeover_confirmed' else op end,
    outcome->>'entityType', (outcome->>'entityId')::uuid, input->>'reason', key,
    case when op = 'takeover' then
      nullif(outcome->'beforePayload', 'null'::jsonb) || jsonb_build_object('deadlineAt', result->'deadlineAt')
      else nullif(outcome->'beforePayload', 'null'::jsonb) end,
    -- Avoid persisting playable payloads or free-text answers into a second store.
    result - 'publicPayload' - 'answers');
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
      and (private.publication_effective_status(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, now_value
      ) = 'closed' or attempt.deadline_at <= now_value)
      and (attempt_id_value is null or attempt.id = attempt_id_value)
      and (room_slug_value is null or room.slug = room_slug_value)
    order by attempt.id
    for update of attempt skip locked
  loop
    if private.close_attempt_as_abandoned(
      attempt_row.id,
      now_value,
      'inactivity_timeout',
      null,
      run_id_value || ':inactivity_timeout:' || attempt_row.id::text,
      '15 minutes without activity after challenge closure or deadline'
    ) then
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

CREATE OR REPLACE FUNCTION private.recover_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  cv private.challenge_versions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      select * into cv from private.challenge_versions where id = a.challenge_version_id;
      if cv.mode = 'alphabet' and instant < unit.deadline_at then
        update private.interaction_intervals
        set ended_at = greatest(segment.started_at, least(instant, unit.deadline_at)),
            end_reason = 'recovery_interrupted'
        where id = segment.id;
        result := jsonb_build_object('receiptId', null, 'recovered', true,
          'recoveryInterrupted', true, 'challengeItemId', segment.challenge_item_id);
      elsif cv.mode <> 'pyramid'
        and question.type in ('mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'word-search', 'word-hashtag', 'zip', 'escape')
        and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id,
          case when question.type = 'word-hashtag'
            then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
            else null end,
          instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.reveal_progressive_clue (
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
  event private.progressive_clue_reveal_events%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  total_clues integer;
  next_index integer;
  effective_penalty integer;
  available_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'reveal_progressive_clue' or cached.input <> safe_input) then
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
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;

  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
  total_clues := jsonb_array_length(question.public_payload->'clues');
  select coalesce(max(e.clue_index), 0) + 1 into next_index
    from private.progressive_clue_reveal_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  if next_index > total_clues then
    raise exception 'all_clues_revealed' using errcode = '55000';
  end if;

  effective_penalty := private.progressive_clue_effective_penalty(
    (question.public_payload->>'cluePenalty')::integer,
    item.points
  );
  available_points := greatest(0, item.points - effective_penalty * (next_index - 1));
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, next_index,
    effective_penalty, available_points, instant, key
  ) returning * into event;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'challengeItemId', item.id,
    'lockVersion', a.lock_version,
    'clueIndex', event.clue_index,
    'clue', question.public_payload->'clues'->>(event.clue_index - 1),
    'revealedClues', event.clue_index,
    'totalClues', total_clues,
    'availablePoints', event.available_points,
    'cluePenalty', event.penalty_points
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'reveal_progressive_clue', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'clueIndex', event.clue_index,
        'availablePoints', event.available_points));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'reveal_progressive_clue', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_logic_code_attempt (
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
  solution private.question_version_solutions%rowtype;
  event private.logic_code_attempt_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  code_length integer;
  sequence_no integer;
  incorrect_attempts integer;
  normalized_code text;
  normalized_solution text;
  solved boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code','clientTimeUsedMs'
    ]))
    or input->>'code' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{code}', to_jsonb(encode(sha256(convert_to(input->>'code', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_logic_code_attempt' or cached.input <> safe_input) then
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
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'logic-code' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  code_length := (question.public_payload->>'codeLength')::integer;
  normalized_code := btrim(input->>'code');
  normalized_solution := solution.solution_payload->>'correctAnswer';
  if code_length not between 1 and 12
    or char_length(normalized_code) <> code_length
    or normalized_code !~ '^[0-9]+$'
    or char_length(normalized_solution) <> code_length
    or normalized_solution !~ '^[0-9]+$' then
    raise exception 'invalid_logic_code' using errcode = '22023';
  end if;
  if exists (select 1 from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.code = normalized_code) then
    raise exception 'duplicate_logic_code' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  solved := normalized_code = normalized_solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.logic_code_attempt_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, code, correct,
    penalty_applied, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized_code, solved,
    not solved, instant, presented, used_ms, key)
  returning * into event;
  if not solved then
    incorrect_attempts := sequence_no;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', false, 'terminal', false,
      'incorrectAttempts', incorrect_attempts);
  else
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    incorrect_attempts := (select count(*)::integer from private.logic_code_attempt_events e
      where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct);
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, to_jsonb(event.code), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', true, 'terminal', true,
      'incorrectAttempts', incorrect_attempts, 'receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_set(result, '{lockVersion}', to_jsonb(a.lock_version));
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_logic_code_attempt', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'sequence', event.sequence, 'terminal', solved));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_logic_code_attempt', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_mini_wordle_guess (
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
  solution private.question_version_solutions%rowtype;
  event private.mini_wordle_guess_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  attempts_used integer;
  max_attempts integer;
  expected_word_length integer;
  normalized_guess text;
  normalized_solution text;
  selected_dictionary_id text;
  feedback jsonb;
  solved boolean;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess','clientTimeUsedMs'
    ]))
    or input->>'guess' is null
  then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{guess}', to_jsonb(encode(sha256(convert_to(input->>'guess', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_mini_wordle_guess' or cached.input <> safe_input) then
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
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'mini-wordle' then raise exception 'unsupported_question' using errcode = '22023'; end if;

  expected_word_length := (question.public_payload->>'wordLength')::integer;
  max_attempts := (question.public_payload->>'maxAttempts')::integer;
  selected_dictionary_id := solution.solution_payload->>'dictionaryId';
  normalized_guess := private.mini_wordle_normalize(input->>'guess');
  normalized_solution := private.mini_wordle_normalize(solution.solution_payload->>'correctAnswer');
  if char_length(normalized_guess) <> expected_word_length or normalized_guess !~ '^[A-ZÑ]+$'
    or not (
      normalized_guess = normalized_solution
      or
      exists (select 1 from private.mini_wordle_dictionary_words d
        where d.dictionary_id = selected_dictionary_id and d.word_length = expected_word_length and d.word = normalized_guess)
      or exists (select 1 from jsonb_array_elements_text(solution.solution_payload->'additionalGuesses') extra(value)
        where private.mini_wordle_normalize(extra.value) = normalized_guess)
    ) then
    raise exception 'invalid_mini_wordle_guess' using errcode = '22023';
  end if;
  if exists (select 1 from private.mini_wordle_guess_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.guess = normalized_guess) then
    raise exception 'duplicate_mini_wordle_guess' using errcode = '55000';
  end if;
  select count(*)::integer into attempts_used from private.mini_wordle_guess_events
    where attempt_id = a.id and challenge_item_id = item.id;
  if attempts_used >= max_attempts then raise exception 'attempt_terminal' using errcode = '55000'; end if;

  feedback := private.mini_wordle_feedback(normalized_guess, normalized_solution);
  solved := normalized_guess = normalized_solution;
  terminal := solved or attempts_used + 1 >= max_attempts;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.mini_wordle_guess_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, guess, feedback, solved,
    received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, attempts_used + 1, normalized_guess, feedback, solved,
    instant, presented, used_ms, key)
  returning * into event;
  if terminal then
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id,
      jsonb_build_object('guesses', (select jsonb_agg(e.guess order by e.sequence)
        from private.mini_wordle_guess_events e where e.attempt_id = a.id and e.challenge_item_id = item.id)),
      instant, presented, effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'sequence', event.sequence, 'guess', event.guess, 'feedback', event.feedback,
    'attemptsUsed', event.sequence, 'maxAttempts', max_attempts, 'terminal', terminal,
    'timeUsedMs', used_ms);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_mini_wordle_guess', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'attemptsUsed', attempts_used),
      jsonb_build_object('lockVersion', a.lock_version, 'attemptsUsed', event.sequence, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_mini_wordle_guess', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_word_hashtag_swap (
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
  solution private.question_version_solutions%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  from_cell integer;
  to_cell integer;
  max_moves integer;
  current_progress jsonb;
  next_progress jsonb;
  state jsonb;
  letters jsonb;
  solution_letters jsonb;
  next_letters jsonb;
  terminal boolean;
  solved boolean := false;
  correct_cells integer[] := array[]::integer[];
  next_moves_used integer;
  next_moves_remaining integer;
  index integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'fromCell') is distinct from 'number'
    or jsonb_typeof(input->'toCell') is distinct from 'number'
    or (input->>'fromCell')::numeric <> trunc((input->>'fromCell')::numeric)
    or (input->>'toCell')::numeric <> trunc((input->>'toCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  from_cell := (input->>'fromCell')::integer;
  to_cell := (input->>'toCell')::integer;
  if from_cell not between 0 and 24 or to_cell not between 0 and 24 or from_cell = to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_hashtag_swap' or cached.input <> safe_input) then
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
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-hashtag' or question.payload_schema_version <> 1
    or not private.word_hashtag_content_valid(question.public_payload, solution.solution_payload) then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  max_moves := (question.public_payload->>'maxMoves')::integer;
  current_progress := coalesce(a.progress_payload, jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', '[]'::jsonb)));
  if current_progress->>'kind' <> 'word-hashtag' or current_progress->>'challengeItemId' <> item.id::text then
    raise exception 'invalid_progress' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)) >= max_moves then
    raise exception 'word_hashtag_moves_exhausted' using errcode = '55000';
  end if;
  state := private.word_hashtag_progress(a.id, item.id);
  letters := state->'letters';
  solution_letters := private.word_hashtag_solution_letters(solution.solution_payload);
  if ((from_cell / 5) not in (1, 3) and (from_cell % 5) not in (1, 3))
    or ((to_cell / 5) not in (1, 3) and (to_cell % 5) not in (1, 3))
    or letters->from_cell is null or letters->to_cell is null
    or letters->from_cell = letters->to_cell
    or letters->from_cell = solution_letters->from_cell
    or letters->to_cell = solution_letters->to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  next_progress := jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('fromCell', from_cell, 'toCell', to_cell))));
  next_letters := jsonb_set(
    jsonb_set(letters, array[from_cell::text], letters->to_cell),
    array[to_cell::text], letters->from_cell
  );
  next_moves_used := (state->>'movesUsed')::integer + 1;
  next_moves_remaining := greatest(0, max_moves - next_moves_used);
  terminal := next_moves_used >= max_moves;
  solved := true;
  for index in 0..24 loop
    if (next_letters->index) is distinct from (solution_letters->index) then
      solved := false;
    elsif (next_letters->index) <> 'null'::jsonb then
      correct_cells := array_append(correct_cells, index);
    end if;
  end loop;
  terminal := terminal or solved;
  if terminal then
    update public.attempts
      set progress_payload = null, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  else
    update public.attempts
      set progress_payload = next_progress, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  end if;
  select * into a from public.attempts where id = a.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = item.id;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, next_progress->'answer', instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
  end if;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'letters', next_letters, 'movesUsed', next_moves_used,
    'movesRemaining', next_moves_remaining, 'correctCells', to_jsonb(correct_cells), 'terminal', terminal);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_hashtag_swap', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'movesUsed', next_moves_used, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_hashtag_swap', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_word_search_selection (
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
  solution private.question_version_solutions%rowtype;
  event private.word_search_selection_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  start_cell_i integer;
  end_cell_i integer;
  target_id text;
  total_words integer;
  grid_rows integer;
  grid_columns integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  terminal boolean;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'startCell') is distinct from 'number'
    or jsonb_typeof(input->'endCell') is distinct from 'number'
    or (input->>'startCell')::numeric <> trunc((input->>'startCell')::numeric)
    or (input->>'endCell')::numeric <> trunc((input->>'endCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  start_cell_i := (input->>'startCell')::integer;
  end_cell_i := (input->>'endCell')::integer;
  if start_cell_i < 0 or end_cell_i < 0 or start_cell_i = end_cell_i then
    raise exception 'invalid_word_search_selection' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_search_selection' or cached.input <> safe_input) then
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
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-search' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(question.public_payload->'letters') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'targets') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'positionsByTargetId') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  total_words := jsonb_array_length(question.public_payload->'targets');
  grid_rows := (question.public_payload->'grid'->>'rows')::integer;
  grid_columns := (question.public_payload->'grid'->>'columns')::integer;

  select positions.key into target_id
  from jsonb_each(solution.solution_payload->'positionsByTargetId') positions
  where (positions.value->>'startCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'endCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'startCell')::integer <> (positions.value->>'endCell')::integer
  limit 1;
  if target_id is null then
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i >= grid_rows * grid_columns or end_cell_i >= grid_rows * grid_columns
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_word_search_selection' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id
      and e.correct and e.matched_target_id = target_id) then
    raise exception 'word_search_target_already_found' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;

  insert into private.word_search_selection_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    start_cell, end_cell, matched_target_id, correct,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    start_cell_i, end_cell_i, target_id, target_id is not null,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.word_search_progress(a.id, item.id);
  terminal := (progress->>'foundCount')::integer = total_words;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id, jsonb_build_object('foundWordIds', progress->'foundWordIds'), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'startCell', event.start_cell, 'endCell', event.end_cell,
    'correct', event.correct, 'terminal', terminal,
    'matchedTargetId', event.matched_target_id,
    'foundSelections', progress->'foundSelections', 'foundWordIds', progress->'foundWordIds',
    'foundCount', progress->'foundCount', 'totalWords', progress->'totalWords',
    'incorrectAttempts', progress->'incorrectAttempts'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_search_selection', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'startCell', event.start_cell,
        'endCell', event.end_cell, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_search_selection', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.take_over_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('takeover', input)
$function$;

REVOKE ALL ON FUNCTION "private"."take_over_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."take_over_attempt"(jsonb) TO "postgres", "service_role";

commit;
