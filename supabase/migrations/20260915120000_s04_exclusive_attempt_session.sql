-- S04 MVP policy: one controlling session per attempt; cross-device takeover is deferred.
create or replace function private.take_over_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'takeover_disabled' using errcode = '55000';
end;
$$;

alter function private.take_over_attempt(jsonb) owner to postgres;
revoke all on function private.take_over_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.take_over_attempt(jsonb) to service_role;
