-- Internal command engine: only the named wrappers at the end receive EXECUTE.
-- The connection adapter MUST verify Auth and set request.jwt.claims transaction-locally.
-- A service JWT by itself is not a human identity. Never copy browser claims without verification.
set local check_function_bodies = off;
create function private.execute_command(op text, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
$$;
create function private.start_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('start', input)
$$;
alter function private.start_attempt(jsonb) owner to postgres;
revoke all on function private.start_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.start_attempt(jsonb) to service_role;

create function private.take_over_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- Cross-device control transfer is deliberately deferred for the MVP.
  raise exception 'takeover_disabled' using errcode = '55000';
end;
$$;
alter function private.take_over_attempt(jsonb) owner to postgres;
revoke all on function private.take_over_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.take_over_attempt(jsonb) to service_role;

create function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- A lost prepare response or a countdown race may leave the interval open.
  -- Re-reading is safe: execute_command exposes only public payload/progress,
  -- and an already received answer is still blocked as evaluation_pending.
  if exists (
    select 1 from private.command_requests
    where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey'
      and operation = 'prepare'
  ) then
    return private.execute_command('prepare', input);
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;

create function private.receive_answer(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('receive', input)
$$;
alter function private.receive_answer(jsonb) owner to postgres;
revoke all on function private.receive_answer(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.receive_answer(jsonb) to service_role;

create function private.pass_interaction(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('pass', input)
$$;
alter function private.pass_interaction(jsonb) owner to postgres;
revoke all on function private.pass_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.pass_interaction(jsonb) to service_role;

create function private.record_evaluation(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('evaluate', input)
$$;
alter function private.record_evaluation(jsonb) owner to postgres;
revoke all on function private.record_evaluation(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.record_evaluation(jsonb) to service_role;

create function private.complete_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('complete', input)
$$;
alter function private.complete_attempt(jsonb) owner to postgres;
revoke all on function private.complete_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.complete_attempt(jsonb) to service_role;

create function private.abandon_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('abandon', input)
$$;
alter function private.abandon_attempt(jsonb) owner to postgres;
revoke all on function private.abandon_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.abandon_attempt(jsonb) to service_role;

create function private.accept_invitation(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('accept_invitation', input)
$$;
alter function private.accept_invitation(jsonb) owner to postgres;
revoke all on function private.accept_invitation(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.accept_invitation(jsonb) to service_role;

create function private.invalidate_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('invalidate', input)
$$;
alter function private.invalidate_attempt(jsonb) owner to postgres;
revoke all on function private.invalidate_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.invalidate_attempt(jsonb) to service_role;

create function private.adjust_result(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  attempt_status text;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) = 'object'
    and input->>'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select attempt.status into attempt_status
    from public.attempts attempt
    where attempt.id = (input->>'attemptId')::uuid;
    if attempt_status is not null and attempt_status not in ('completed', 'abandoned') then
      raise exception 'attempt_not_terminal' using errcode = '55000';
    end if;
  end if;
  return private.execute_command('adjust', input);
end;
$$;
alter function private.adjust_result(jsonb) owner to postgres;
revoke all on function private.adjust_result(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.adjust_result(jsonb) to service_role;

alter function private.execute_command(text, jsonb) owner to postgres;
revoke all on function private.execute_command(text, jsonb) from public, anon, authenticated, service_role;
