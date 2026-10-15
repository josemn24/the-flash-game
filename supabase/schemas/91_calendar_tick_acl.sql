-- Private entrypoints remain available to transactional gameplay commands.
grant execute on function private.run_calendar_tick_command(jsonb) to service_role;
grant execute on function private.expire_stale_attempts(jsonb) to service_role;

-- PostgREST hoists statement_timeout before executing each RPC. Keep expiration's
-- independent budget out of the calendar tick and its nested private call.
-- The tick must also override authenticator's inherited lock_timeout.
create function public.run_calendar_tick(input jsonb) returns jsonb
language sql volatile security invoker
set search_path = '' set statement_timeout = '0' set lock_timeout = '0' as $$
  select private.run_calendar_tick_command(input);
$$;

create function public.expire_stale_attempts(input jsonb) returns jsonb
language sql volatile security invoker
set search_path = '' set statement_timeout = '5s' as $$
  select private.expire_stale_attempts(input);
$$;

alter function public.run_calendar_tick(jsonb) owner to postgres;
alter function public.expire_stale_attempts(jsonb) owner to postgres;
revoke all on function public.run_calendar_tick(jsonb), public.expire_stale_attempts(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.run_calendar_tick(jsonb), public.expire_stale_attempts(jsonb)
  to service_role;
