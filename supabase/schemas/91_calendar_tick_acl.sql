-- The tick has no Data API wrapper. Only the local server connection, after
-- SET LOCAL ROLE service_role, may invoke the private execution command.
grant execute on function private.run_calendar_tick_command(jsonb) to service_role;
grant execute on function private.expire_stale_attempts(jsonb) to service_role;
