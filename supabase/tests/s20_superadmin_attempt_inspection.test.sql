begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @regrade-fixtures

select ok(has_function_privilege('authenticated', 'public.get_superadmin_attempt_publications(uuid)', 'EXECUTE'),
  'Superadmin attempt publications are exposed only through authenticated RPC');
select ok(not has_function_privilege('anon', 'public.get_superadmin_attempt_publications(uuid)', 'EXECUTE'),
  'Anonymous users cannot list superadmin publications');
select ok(not has_function_privilege('service_role', 'public.get_superadmin_attempt_inspection(uuid,uuid,uuid)', 'EXECUTE'),
  'Service role cannot bypass the application superadmin read boundary');
select ok(has_function_privilege('service_role', 'private.regrade_answer(jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.regrade_answer(jsonb)', 'EXECUTE'),
  'Only the trusted server can execute question regrades');
select ok(has_function_privilege('service_role', 'private.prepare_attempt_answer_regrade(jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.prepare_attempt_answer_regrade(jsonb)', 'EXECUTE'),
  'Only the trusted server can prepare or replay question regrades');
select ok(not has_table_privilege('authenticated', 'private.attempt_answer_regrades', 'SELECT')
  and not has_table_privilege('service_role', 'private.attempt_answer_regrades', 'UPDATE'),
  'Regrade history has no direct client read or service write access');

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
select test_support.run('complete_attempt', '{}');
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
select ok((public.get_superadmin_attempt_inspection(
  test_support.id('room-flash'), test_support.id('sc-flash'),
  (select attempt_id from s20_context))->'attempt' ? 'avatarPath')
  and (public.get_superadmin_attempt_inspection(
    test_support.id('room-flash'), test_support.id('sc-flash'),
    (select attempt_id from s20_context))->'attempt' ? 'isCorrected'),
  'Inspection returns the complete attempt projection required by the portal');
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

select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-regrade'), 'sessionToken', repeat('r', 40)));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":"Cañon"}');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select test_support.run('complete_attempt', '{}');
create temp table s20_regrade_context (attempt_id uuid, input jsonb) on commit drop;
grant select on s20_regrade_context to authenticated;
insert into s20_regrade_context
select (state->>'attemptId')::uuid, jsonb_build_object(
  'idempotencyKey','s20-regrade-001',
  'attemptId',state->>'attemptId',
  'lockVersion',(state->>'lockVersion')::bigint,
  'reason','La versión publicada añade Cañón',
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric')
) from test_support.runtime;
select throws_ok('select private.prepare_attempt_answer_regrade(input) from s20_regrade_context',
  '42501', 'not_authorized', 'An ordinary player cannot prepare a regrade');
reset role;

-- Equal transaction timestamps and UUIDs in reverse order expose timestamp-based ordering.
create function test_support.reverse_regrade_ids() returns trigger language plpgsql as $$
begin
  new.id := case right(new.idempotency_key, 3)
    when '001' then '30000000-0000-0000-0000-000000000000'::uuid
    when '002' then '20000000-0000-0000-0000-000000000000'::uuid
    when '003' then '10000000-0000-0000-0000-000000000000'::uuid
    else new.id end;
  return new;
end;
$$;
create trigger reverse_regrade_ids before insert on private.attempt_answer_regrades
  for each row execute function test_support.reverse_regrade_ids();

select test_support.as_actor('superadmin');
set local role service_role;
select ok((select private.prepare_attempt_answer_regrade(input)->'context'->'acceptedAnswers'
  from s20_regrade_context) @> '["Cañón"]'::jsonb, 'A fresh confirmation receives evaluation context');
select ok((private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context))))->'acceptedAnswers')
  @> '["Cañón"]'::jsonb,
  'The preview context supplies accepted answers from the selected published rubric');
select throws_ok($$select private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-normal'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context))))$$,
  '22023', 'invalid_command', 'A rubric from another question is rejected');
select throws_ok($$select private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-draft'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context))))$$,
  '22023', 'invalid_command', 'Draft rubrics are rejected');
select throws_ok($$select private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-other-format'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context))))$$,
  '22023', 'invalid_command', 'A rubric with another question format is rejected');
select private.regrade_answer(input || '{"resultStatus":"correct","resultPoints":31}'::jsonb)
from s20_regrade_context;
select is((select score from public.attempts where id=(select attempt_id from s20_regrade_context)),0,
  'A question regrade preserves the original attempt score');
select is((select sum(amount)::integer from private.flash_point_entries where attempt_id=(select attempt_id from s20_regrade_context)),31,
  'A question regrade adds only its item delta to the effective ledger');
select is((select count(*) from private.attempt_answer_regrades where attempt_id=(select attempt_id from s20_regrade_context)),1::bigint,
  'A question regrade appends one immutable evaluation event');
reset role;
set local role authenticated;
select ok((public.get_superadmin_attempt_inspection(test_support.id('room-regrade'),test_support.id('sc-regrade'),
  (select attempt_id from s20_regrade_context))->'items'->0) @> jsonb_build_object(
    'status','incorrect','effectiveStatus','correct','awardedPoints',0,'effectiveAwardedPoints',31,
    'currentRubricVersionId',test_support.id('qv-regrade-rubric')),
  'Inspection preserves the original result and exposes the effective regraded result');
select is((public.get_superadmin_attempt_inspection(test_support.id('room-regrade'),
  test_support.id('sc-regrade'), (select attempt_id from s20_regrade_context))->'items'->0->'availableRubrics'),
  jsonb_build_array(
    jsonb_build_object('questionVersionId',test_support.id('qv-regrade-rubric'),'versionNumber',2),
    jsonb_build_object('questionVersionId',test_support.id('qv-regrade-original'),'versionNumber',1)),
  'A historical image with an answer-revealing caption returns only compatible published rubric IDs and versions');
reset role;
select test_support.as_actor('member');
set local role authenticated;
select is((select flash_points from public.get_challenge_ranking(test_support.id('sc-regrade'))
  where player_id=test_support.id('member')),31::bigint,
  'The player ranking uses the effective points from the question regrade');
reset role;
select test_support.as_actor('superadmin');
set local role service_role;
select is(
  (select private.prepare_attempt_answer_regrade(input)->'result' from s20_regrade_context),
  (select private.regrade_answer(input || '{"resultStatus":"correct","resultPoints":31}'::jsonb)
    from s20_regrade_context),
  'Retrying the original confirmation returns the stored result despite the advanced lock version');
select throws_ok($$select private.prepare_attempt_answer_regrade(input || '{"reason":"Otro motivo"}'::jsonb)
  from s20_regrade_context$$, '40001', 'idempotency_conflict',
  'A retry with a different reason conflicts');
select is((select count(*) from private.attempt_answer_regrades where attempt_id=(select attempt_id from s20_regrade_context)),1::bigint,
  'Repeating the same question regrade does not append another event');
select is((select count(*) from private.flash_point_entries where attempt_id=(select attempt_id from s20_regrade_context) and entry_type='answer_regrade'),1::bigint,
  'Repeating the same question regrade does not duplicate its ledger delta');
select is((select count(*) from private.audit_log where entity_id=(select attempt_id from s20_regrade_context)
  and action='regrade_answer'),1::bigint, 'Repeating the same question regrade does not duplicate its audit entry');
select throws_ok($$select private.regrade_answer(jsonb_build_object(
  'idempotencyKey','s20-regrade-over-max',
  'attemptId',(select attempt_id from s20_regrade_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context)),
  'reason','Puntuación superior al máximo',
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'resultStatus','correct','resultPoints',101))$$,
  '22023', 'invalid_score', 'Points above the item maximum are rejected');
select throws_ok($$select private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'lockVersion',(select lock_version - 1 from public.attempts where id=(select attempt_id from s20_regrade_context))))$$,
  '40001', 'stale_version', 'A changed attempt requires a fresh preview');
select private.regrade_answer(jsonb_build_object(
  'idempotencyKey','s20-regrade-002',
  'attemptId',(select attempt_id from s20_regrade_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context)),
  'reason','Primera revisión de puntos',
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'resultStatus','correct','resultPoints',20));
select ok((private.regrade_answer(jsonb_build_object(
  'idempotencyKey','s20-regrade-003',
  'attemptId',(select attempt_id from s20_regrade_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context)),
  'reason','Segunda revisión de puntos',
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'resultStatus','correct','resultPoints',10))) @> '{"beforePoints":20,"difference":-10,"effectiveScore":10}'::jsonb,
  'The third regrade subtracts ten using the latest attempt version');
select is((select count(*) from private.attempt_answer_regrades where attempt_id=(select attempt_id from s20_regrade_context)),3::bigint,
  'Each confirmed rubric evaluation remains in the append-only history');
select is((select count(distinct created_at) from private.attempt_answer_regrades
  where attempt_id=(select attempt_id from s20_regrade_context)),1::bigint, 'All three regrades share a timestamp');
select ok(private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_regrade_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context))))
  @> '{"currentPoints":10,"effectiveScore":10}'::jsonb, 'Preview uses the latest regrade');
reset role;
set local role authenticated;
select is((public.get_superadmin_attempt_inspection(test_support.id('room-regrade'),test_support.id('sc-regrade'),
  (select attempt_id from s20_regrade_context))->'items'->0->>'effectiveAwardedPoints')::integer,10,
  'Inspection uses the latest regrade');
select test_support.as_actor('member');
select is((select flash_points from public.get_challenge_ranking(test_support.id('sc-regrade'))
  where player_id=test_support.id('member')),10::bigint, 'Ranking uses the latest effective balance');
reset role;
update public.scheduled_challenges set status='cancelled', cancelled_at=now()
where id=test_support.id('sc-regrade');
select test_support.as_actor('superadmin');
set local role service_role;
select throws_ok($$select private.regrade_answer(jsonb_build_object(
  'idempotencyKey','s20-regrade-cancelled',
  'attemptId',(select attempt_id from s20_regrade_context),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_regrade_context)),
  'reason','Publicación cancelada',
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'resultStatus','correct','resultPoints',31))$$,
  '55000', 'publication_cancelled', 'Cancelled publications cannot be regraded');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object(
  'scheduledChallengeId', test_support.id('sc-fast'), 'sessionToken', repeat('f', 40)));
delete from s20_context;
insert into s20_context
select (state->>'attemptId')::uuid from test_support.runtime;
select test_support.as_actor('superadmin');
select throws_ok($$select private.read_attempt_answer_regrade_context(jsonb_build_object(
  'attemptId',(select attempt_id from s20_context),
  'challengeItemId',test_support.id('item-regrade'),
  'rubricQuestionVersionId',test_support.id('qv-regrade-rubric'),
  'lockVersion',(select lock_version from public.attempts where id=(select attempt_id from s20_context))))$$,
  '55000', 'attempt_not_terminal', 'In-progress attempts cannot be regraded');
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
