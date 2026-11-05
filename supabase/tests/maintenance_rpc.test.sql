begin;
set local search_path = public, extensions;
select no_plan();

select ok(has_function_privilege('service_role', fn, 'EXECUTE'), fn || ': service may execute')
from unnest(array['public.run_calendar_tick(jsonb)', 'public.expire_stale_attempts(jsonb)']) fn;
select ok(not has_function_privilege(role_name, fn, 'EXECUTE'), fn || ': denied to ' || role_name)
from unnest(array['anon','authenticated']) role_name
cross join unnest(array['public.run_calendar_tick(jsonb)', 'public.expire_stale_attempts(jsonb)']) fn;
select ok(not exists (
  select 1 from aclexplode(p.proacl) acl where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
), p.proname || ': PUBLIC has no EXECUTE')
from pg_proc p where p.oid in ('public.run_calendar_tick(jsonb)'::regprocedure, 'public.expire_stale_attempts(jsonb)'::regprocedure);
select ok(not p.prosecdef and p.provolatile = 'v' and l.lanname = 'sql'
  and pg_get_userbyid(p.proowner) = 'postgres' and p.proconfig @> array['search_path=""'],
  p.proname || ': invoker, volatile SQL, owner and pinned search path')
from pg_proc p join pg_language l on l.oid = p.prolang
where p.oid in ('public.run_calendar_tick(jsonb)'::regprocedure, 'public.expire_stale_attempts(jsonb)'::regprocedure);
select ok(proconfig @> array['statement_timeout=0'], 'Tick overrides inherited SQL timeout')
from pg_proc where oid = 'public.run_calendar_tick(jsonb)'::regprocedure;
select ok(proconfig @> array['lock_timeout=0'], 'Tick overrides inherited lock timeout')
from pg_proc where oid = 'public.run_calendar_tick(jsonb)'::regprocedure;
select ok(proconfig @> array['statement_timeout=5s'], 'Independent expiration keeps its five second budget')
from pg_proc where oid = 'public.expire_stale_attempts(jsonb)'::regprocedure;
select ok(not exists (
  select 1 from pg_proc p, unnest(p.proconfig) setting
  where p.oid in ('private.run_calendar_tick_command(jsonb)'::regprocedure, 'private.expire_stale_attempts(jsonb)'::regprocedure)
    and setting like 'statement_timeout=%'
), 'Private calls do not inherit the standalone RPC budget');

set local role service_role;
select throws_ok($$select public.run_calendar_tick('{}'::jsonb)$$, '22023', 'calendar_tick_invalid', 'Tick keeps input validation');
select throws_ok($$select public.expire_stale_attempts('{}'::jsonb)$$, '22023', 'attempt_expiration_invalid', 'Expiration keeps input validation');
select is((public.expire_stale_attempts('{"runId":"rpc-empty-room","roomSlug":"missing-room"}'::jsonb)->>'abandonedAttempts')::integer, 0,
  'Expiration supports room-scoped empty results');
reset role;

select * from finish();
rollback;
