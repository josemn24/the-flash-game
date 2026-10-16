begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @question-library-fixtures
select test_support.as_actor('superadmin');
select lives_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  'Active platform superadmin can read solutions');
select test_support.as_actor('member');
set local role authenticated;
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Authenticated member cannot read a known question');
select throws_ok($q$select public.get_superadmin_question_version('00000000-0000-0000-0000-000000000000')$q$,
  '42501', 'not_authorized', 'Authorization precedes missing identifier lookup');
select throws_ok($q$select public.get_superadmin_question_version(null)$q$,
  '42501', 'not_authorized', 'Authorization precedes null identifier lookup');
reset role;
select test_support.as_actor('owner');
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Room ownership does not grant editorial access');
update public.room_memberships set role = 'admin' where player_id = test_support.id('member');
select test_support.as_actor('member');
select throws_ok($q$select private.question_version_detail(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Room admin cannot bypass authorization through the private detail');
select set_config('request.jwt.claims', '{"role":"superadmin","is_anonymous":false}', true);
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Unprovisioned claims cannot grant platform access');
insert into auth.users(id) values (test_support.id('auth-library-no-player'));
select set_config('request.jwt.claims', jsonb_build_object('sub', test_support.id('auth-library-no-player'), 'is_anonymous', false)::text, true);
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'An authenticated account without a player cannot read detail');
select test_support.as_actor('superadmin');
delete from private.platform_role_assignments where player_id = test_support.id('superadmin');
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Removing the platform assignment immediately revokes detail access');
insert into private.platform_role_assignments(player_id, role) values (test_support.id('superadmin'), 'superadmin');
select set_config('request.jwt.claims', jsonb_build_object('sub', test_support.id('auth-superadmin'), 'is_anonymous', true)::text, true);
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Anonymous Auth session cannot use a superadmin assignment');
update public.room_memberships set status = 'banned', ended_at = now() where player_id = test_support.id('member');
select test_support.as_actor('member');
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Banned room member has no editorial access');
update public.players set status = 'anonymized' where id = test_support.id('superadmin');
select test_support.as_actor('superadmin');
select throws_ok($q$select public.get_superadmin_question_version(test_support.id('library-version-1'))$q$,
  '42501', 'not_authorized', 'Inactive superadmin without an Auth link cannot read detail');
select ok(not has_function_privilege(role_name, signature, 'EXECUTE'), role_name || ' cannot execute ' || signature)
from unnest(array['anon','service_role']) role_name cross join unnest(array[
  'public.get_superadmin_question_version(uuid)', 'public.get_superadmin_question_library(jsonb)']) signature;
select ok(not has_function_privilege(role_name, signature, 'EXECUTE'), role_name || ' cannot execute ' || signature)
from unnest(array['anon','authenticated','service_role']) role_name cross join unnest(array[
  'private.question_version_document(uuid)', 'private.question_version_detail(uuid)',
  'private.read_superadmin_question_library(jsonb)', 'private.create_question_draft_command(jsonb)',
  'private.update_question_draft_command(jsonb)', 'private.publish_question_command(jsonb)',
  'private.archive_question_command(jsonb)']) signature;
select * from finish();
rollback;
