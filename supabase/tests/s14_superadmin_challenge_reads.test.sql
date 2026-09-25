-- S14 challenge catalog/detail read boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.get_superadmin_challenge_catalog()', 'EXECUTE'),
  'Authenticated can read the challenge catalog boundary');
select ok(has_function_privilege('authenticated', 'public.get_superadmin_challenge_detail(uuid)', 'EXECUTE'),
  'Authenticated can read a challenge detail boundary');
select ok(not has_function_privilege('anon', 'public.get_superadmin_challenge_catalog()', 'EXECUTE'),
  'Anonymous users cannot read the challenge catalog');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.get_superadmin_challenge_detail(uuid)'::regprocedure), 'postgres',
  'Challenge detail is owned by postgres');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select is(jsonb_array_length(public.get_superadmin_challenge_catalog()->'entries'), 2,
  'The catalog contains only Flash challenge definitions');
select ok(not (public.get_superadmin_challenge_catalog()->'entries'->0 ? 'document'),
  'The catalog does not expose editorial documents or private solutions');
select is(jsonb_array_length(public.get_superadmin_challenge_detail(test_support.id('cd-flash'))->'entries'), 1,
  'The detail returns all versions for one Flash definition');
select is(public.get_superadmin_challenge_detail(test_support.id('cd-alphabet')), null::jsonb,
  'Non-Flash definitions are not available in the Flash detail');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
select throws_ok($$select public.get_superadmin_challenge_catalog()$$, '42501', 'not_authorized',
  'A member cannot read the challenge catalog');
select throws_ok($$select public.get_superadmin_challenge_detail(test_support.id('cd-flash'))$$, '42501', 'not_authorized',
  'A member cannot read challenge details');

select * from finish();
rollback;
