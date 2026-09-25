begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.get_superadmin_attempt_publications(uuid)', 'EXECUTE'),
  'Superadmin attempt publications are exposed only through authenticated RPC');
select ok(not has_function_privilege('anon', 'public.get_superadmin_attempt_publications(uuid)', 'EXECUTE'),
  'Anonymous users cannot list superadmin publications');
select ok(not has_function_privilege('service_role', 'public.get_superadmin_attempt_inspection(uuid,uuid,uuid)', 'EXECUTE'),
  'Service role cannot bypass the application superadmin read boundary');

select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('s', 40)));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":false}');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select test_support.run('complete_attempt', '{"score":50}');
create temp table s20_context (attempt_id uuid) on commit drop;
grant select on s20_context to authenticated;
insert into s20_context
select (state->>'attemptId')::uuid from test_support.runtime;
reset role;

select test_support.as_actor('superadmin');
set local role authenticated;
select ok((public.get_superadmin_attempt_publications(test_support.id('room-flash'))->'entries') @> jsonb_build_array(
  jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'mode', 'flash')),
  'Superadmin sees the published challenge in the selected room');
select ok(not (public.get_superadmin_attempt_publications(test_support.id('room-flash'))->'entries')::text like '%solution_payload%',
  'Publication summaries do not expose private solutions');
select ok((public.get_superadmin_room_attempts(
  test_support.id('room-flash'), test_support.id('sc-flash'), null, null, 50)->'attempts') @> jsonb_build_array(
    jsonb_build_object('playerId', test_support.id('member'))),
  'Superadmin sees competitive attempts for the selected publication');
select is(jsonb_array_length(public.get_superadmin_room_attempts(
  test_support.id('room-flash'), test_support.id('sc-flash'), null, null, 50)->'attempts'), 1,
  'The attempt list excludes non-existent and test attempts');
select is(jsonb_array_length(public.get_superadmin_attempt_inspection(
  test_support.id('room-flash'), test_support.id('sc-flash'),
  (select attempt_id from s20_context))->'items'), 2,
  'Inspection returns the frozen item projection and evaluated answers');
select ok(not (public.get_superadmin_attempt_inspection(
  test_support.id('room-flash'), test_support.id('sc-flash'),
  (select attempt_id from s20_context)))::text like '%solution_payload%',
  'Inspection never serializes private solution payloads');
reset role;

set local role service_role;
select private.adjust_result(jsonb_build_object(
  'idempotencyKey', 's20-adjust-001',
  'attemptId', (select attempt_id from s20_context),
  'lockVersion', (select lock_version from public.attempts where id = (select attempt_id from s20_context)),
  'reason', 'Corrección de evaluación',
  'score', 20));
select is((select score from public.attempts where id = (select attempt_id from s20_context)), 50,
  'Adjustment preserves the original score');
select is((select sum(amount)::integer from private.flash_point_entries where attempt_id = (select attempt_id from s20_context)), 20,
  'Adjustment changes only the effective ledger balance');
select is((select count(*) from private.audit_log where action = 'adjust' and entity_id = (select attempt_id from s20_context)), 1::bigint,
  'Adjustment creates one audit entry');
select private.adjust_result(jsonb_build_object(
  'idempotencyKey', 's20-adjust-001',
  'attemptId', (select attempt_id from s20_context),
  'lockVersion', (select lock_version - 1 from public.attempts where id = (select attempt_id from s20_context)),
  'reason', 'Corrección de evaluación',
  'score', 20));
select is((select count(*) from private.flash_point_entries where attempt_id = (select attempt_id from s20_context) and entry_type = 'adjustment'), 1::bigint,
  'Repeating the same adjustment is idempotent');
select throws_ok($$select private.adjust_result(jsonb_build_object(
  'idempotencyKey','s20-adjust-invalid',
  'attemptId',(select attempt_id from s20_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_context)),
  'reason','', 'score',10))$$, '22023', 'reason_required', 'An empty adjustment reason is rejected');
select throws_ok($$select private.adjust_result(jsonb_build_object(
  'idempotencyKey','s20-adjust-status',
  'attemptId',(select attempt_id from s20_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_context)),
  'reason','invalid score', 'score',101))$$, '22023', 'invalid_score', 'An out-of-range adjustment is rejected');
select private.invalidate_attempt(jsonb_build_object(
  'idempotencyKey', 's20-invalidate-001',
  'attemptId', (select attempt_id from s20_context),
  'lockVersion', (select lock_version from public.attempts where id = (select attempt_id from s20_context)),
  'reason', 'Resultado inválido'));
select is((select status from public.attempts where id = (select attempt_id from s20_context)), 'invalidated',
  'Invalidation changes the attempt status');
select is((select sum(amount)::integer from private.flash_point_entries where attempt_id = (select attempt_id from s20_context)), 0,
  'Invalidation reverses the effective balance');
select test_support.as_actor('member');
set local role authenticated;
select is((select count(*) from public.get_challenge_ranking(test_support.id('sc-flash'))), 0::bigint,
  'Invalidated attempts are excluded from rankings');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-fast'), 'sessionToken', repeat('f', 40)));
delete from s20_context;
insert into s20_context
select (state->>'attemptId')::uuid from test_support.runtime;
select test_support.as_actor('superadmin');
select throws_ok($$select private.adjust_result(jsonb_build_object(
  'idempotencyKey','s20-adjust-in-progress',
  'attemptId',(select attempt_id from s20_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_context)),
  'reason','No debe operar en curso', 'score',0))$$, '55000', 'attempt_not_terminal',
  'In-progress attempts cannot be adjusted');
reset role;

select test_support.as_actor('member');
set local role authenticated;
select throws_ok($$select public.get_superadmin_attempt_inspection(
  test_support.id('room-flash'), test_support.id('sc-flash'),
  (select attempt_id from s20_context))$$, '42501', null,
  'Ordinary players cannot inspect administrative attempts');
reset role;

select * from finish();
rollback;
