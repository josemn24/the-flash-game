-- E01: allow a recovered Mini-Wordle interaction to be re-read while its
-- authoritative interval remains open. Other open Flash interactions retain
-- the explicit recovery_required guard.
create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from private.command_requests
    where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey'
      and operation = 'prepare'
  ) then
    return private.execute_command('prepare', input);
  end if;
  if exists (
    select 1 from private.interaction_intervals x
    join public.attempts a on a.id = x.attempt_id
    join private.challenge_versions cv on cv.id = a.challenge_version_id
    join private.challenge_items ci on ci.id = x.challenge_item_id
    join private.question_versions q on q.id = ci.question_version_id
    where x.attempt_id = (input->>'attemptId')::uuid and x.ended_at is null and cv.mode = 'flash'
      and q.type <> 'mini-wordle'
  ) then
    raise exception 'recovery_required' using errcode = '55000';
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;
