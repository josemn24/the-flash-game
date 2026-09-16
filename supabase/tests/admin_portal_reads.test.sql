-- Minimal superadmin portal read boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('admin-portal:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id)
select pg_temp.test_id('auth-' || name)
from unnest(array['superadmin', 'member']) name;
insert into public.players (id, auth_user_id, display_name)
values
  (pg_temp.test_id('superadmin'), pg_temp.test_id('auth-superadmin'), 'Operador beta'),
  (pg_temp.test_id('member'), pg_temp.test_id('auth-member'), 'Jugador beta');
insert into private.platform_role_assignments (player_id, role)
values (pg_temp.test_id('superadmin'), 'superadmin');
insert into public.rooms (id, slug, title, status, deleted_at)
values
  (pg_temp.test_id('active-a'), 'portal-a', 'Sala A', 'active', null),
  (pg_temp.test_id('active-b'), 'portal-b', 'Sala B', 'active', null),
  (pg_temp.test_id('deleted'), 'portal-deleted', 'Sala eliminada', 'deleted', now());
insert into public.room_memberships (room_id, player_id, role)
values (pg_temp.test_id('active-a'), pg_temp.test_id('member'), 'member');

select ok(has_function_privilege('authenticated', 'public.get_superadmin_portal_context()', 'EXECUTE'),
  'Authenticated can call the superadmin portal context');
select ok(not has_function_privilege('anon', 'public.get_superadmin_portal_context()', 'EXECUTE'),
  'Anonymous users cannot call the superadmin portal context');
select ok(not has_function_privilege('service_role', 'public.get_superadmin_portal_context()', 'EXECUTE'),
  'service_role cannot use the application portal boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.get_superadmin_portal_context()'::regprocedure), 'postgres',
  'Portal context is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.get_superadmin_portal_context()'::regprocedure),
  'Portal context clears search_path');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is(public.get_superadmin_portal_context()->'operator'->>'playerId',
  pg_temp.test_id('superadmin')::text, 'Operator identity comes from Auth and the player row');
select is(public.get_superadmin_portal_context()->'operator'->>'displayName',
  'Operador beta', 'Operator display name is projected');
select is(jsonb_array_length(public.get_superadmin_portal_context()->'rooms'), 2,
  'Superadmin sees every active room without membership');
select ok(not (public.get_superadmin_portal_context()->'rooms') @> jsonb_build_array(
  jsonb_build_object('slug', 'portal-deleted')
), 'Deleted rooms are excluded');
select ok(not (public.get_superadmin_portal_context())::text like '%platform_role_assignments%',
  'Private role assignment details are not projected');
select throws_ok('select * from private.platform_role_assignments', '42501', null,
  'Superadmin browser cannot read private role assignments directly');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok('select public.get_superadmin_portal_context()', '42501', null,
  'A normal member cannot use the portal context');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-member'), 'role', 'authenticated',
  'user_metadata', jsonb_build_object('role', 'superadmin')
)::text, true);
set local role authenticated;
select throws_ok('select public.get_superadmin_portal_context()', '42501', null,
  'Editable metadata cannot forge superadmin');
reset role;

set local role anon;
select throws_ok('select public.get_superadmin_portal_context()', '42501', null,
  'Anonymous access is denied');
reset role;

set local role service_role;
select throws_ok('select public.get_superadmin_portal_context()', '42501', null,
  'service_role has no application execute privilege');
reset role;

select * from finish();
rollback;
