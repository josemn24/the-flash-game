-- Attempt operations invoked only by the authorized coordinator.
set local check_function_bodies = off;

create function private.handle_attempt_takeover(
  input jsonb,
  safe_input jsonb,
  target_attempt public.attempts,
  instant timestamptz
) returns table(updated_attempt public.attempts, operation_result jsonb, clear_progress boolean)
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  session_row private.attempt_sessions%rowtype;
  result jsonb;
begin
  clear_progress := false;
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
  updated_attempt := a;
  operation_result := result;
  clear_progress := coalesce(clear_progress, false);
  return next;
end;
$$;
alter function private.handle_attempt_takeover(jsonb, jsonb, public.attempts, timestamptz) owner to postgres;
revoke all on function private.handle_attempt_takeover(jsonb, jsonb, public.attempts, timestamptz) from public, anon, authenticated, service_role;
