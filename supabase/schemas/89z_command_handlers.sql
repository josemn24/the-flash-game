-- Internal attempt coordinator. The dispatcher owns idempotency and audit writes.
set local check_function_bodies = off;

create function private.handle_attempt_command(
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
            and question.type = 'connect-pairs'
            and received < unit.deadline_at
            and (cv.mode <> 'time-trial' or received < a.deadline_at)
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
alter function private.handle_attempt_command(text, jsonb, jsonb, uuid, jsonb, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_command(text, jsonb, jsonb, uuid, jsonb, timestamptz) from public, anon, authenticated, service_role;
