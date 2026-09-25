-- Preserve the existing command-level retry result before enforcing recovery.
create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.command_requests where actor_id = private.command_actor()
    and idempotency_key = prepare_interaction.input->>'idempotencyKey' and operation = 'prepare') then
    return private.execute_command('prepare', input);
  end if;
  if exists (select 1 from private.interaction_intervals
    where attempt_id = (input->>'attemptId')::uuid and ended_at is null) then
    raise exception 'recovery_required' using errcode = '55000';
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;
