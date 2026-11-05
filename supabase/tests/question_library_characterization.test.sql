-- Fixed expectations for the predecessor and the corrected schema alike.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @question-library-fixtures
select test_support.as_actor('superadmin');

insert into test_support.library_results(label, result) values ('detail',
  public.get_superadmin_question_version(test_support.id('library-version-1')));
select is((select result->>'slug' from test_support.library_results where label = 'detail'),
  'library-fixture-001', 'Detail resolves the definition from any version');
select is((select jsonb_array_length(result->'versions') from test_support.library_results where label = 'detail'),
  4, 'Detail includes draft, published and archived history');
select is((select jsonb_agg(entry->'versionNumber' order by ordinal)
  from test_support.library_results cross join lateral jsonb_array_elements(result->'versions')
    with ordinality as v(entry, ordinal) where label = 'detail'), '[4,3,2,1]'::jsonb,
  'Detail orders versions descending');
select is((select result->'versions'->3->'document' from test_support.library_results where label = 'detail'),
  jsonb_build_object('slug', 'library-fixture-001', 'type', 'true-false', 'payloadSchemaVersion', 1,
    'difficulty', 'medium', 'timeLimitMs', 30000, 'publicPayload', jsonb_build_object('question', 'Library original 1',
      'category', 'Library', 'tags', jsonb_build_object('topic', 'original', 'group', 1)),
    'solutionPayload', '{"correctAnswer":true,"explanation":"Library solution"}'::jsonb),
  'Authorized detail preserves the complete private document');
select ok((select bool_and((entry->>'versionCount')::integer = 4 and (entry->>'usageCount')::integer = 0)
  from test_support.library_results cross join lateral jsonb_array_elements(result->'versions') entry
  where label = 'detail'), 'Detail counts every version and its exact uses');
select is(test_support.library_error($q$select public.get_superadmin_question_version(null)$q$),
  '{"sqlstate":"P0002","message":"content_not_found","detail":""}'::jsonb, 'Null detail identifier retains its error');
select is(test_support.library_error($q$select public.get_superadmin_question_version('00000000-0000-0000-0000-000000000000')$q$),
  '{"sqlstate":"P0002","message":"content_not_found","detail":""}'::jsonb, 'Missing detail retains its error');

select is(public.get_superadmin_question_library('{"search":"library-fixture","status":"all"}')->>'total', '128',
  'All status includes every matching version');
select is(public.get_superadmin_question_library('{"search":"library-fixture"}')->>'total', '125',
  'Default published status counts definitions');
select is(public.get_superadmin_question_library('{"search":"replacement","status":"published"}')->>'total', '1',
  'Search matches question text');
select is(public.get_superadmin_question_library('{"search":"library-fixture","status":"published","tag":"ORIGINAL"}')->>'total', '125',
  'Tags remain case insensitive and filters precede latest-version selection');
select is(public.get_superadmin_question_library('{"search":"library-fixture-001","status":"published","tag":"original"}')->'entries'->0->>'questionVersionId',
  test_support.id('library-version-1')::text, 'Latest matching published version can be older than another publication');
select is(public.get_superadmin_question_library('{"search":"library-fixture-001","status":"all"}')->>'total', '4',
  'All status does not deduplicate');
select is(public.get_superadmin_question_library('{"search":"library-fixture","status":"draft"}')->>'total', '1', 'Draft filter is exact');
select is(public.get_superadmin_question_library('{"search":"library-fixture","status":"archived"}')->>'total', '1', 'Archived filter is exact');
select is(public.get_superadmin_question_library('{"search":"library-fixture","type":"multiple-choice"}')->'entries', '[]'::jsonb,
  'Type filter excludes nonmatching versions');
select is(public.get_superadmin_question_library('{"search":"   missing-library   "}'),
  '{"entries":[],"total":0,"page":1,"pageSize":25}'::jsonb, 'Empty response and defaults are stable');
select is(public.get_superadmin_question_library('{"search":"missing-library","page":0,"pageSize":0}'),
  '{"entries":[],"total":0,"page":1,"pageSize":1}'::jsonb, 'Lower pagination bounds are clamped');
select is(public.get_superadmin_question_library('{"search":"missing-library","page":999999,"pageSize":999999}'),
  '{"entries":[],"total":0,"page":10000,"pageSize":100}'::jsonb, 'Upper pagination bounds are clamped');
select is(public.get_superadmin_question_library('{"search":"missing-library","page":null,"pageSize":null,"status":null}'),
  '{"entries":[],"total":0,"page":1,"pageSize":25}'::jsonb, 'JSON null pagination and status use their defaults');
select is(test_support.library_error('select public.get_superadmin_question_library(null)'),
  '{"sqlstate":"22023","message":"invalid_command","detail":""}'::jsonb, 'SQL null envelope is rejected');
select is(test_support.library_error($q$select public.get_superadmin_question_library('null')$q$),
  '{"sqlstate":"22023","message":"invalid_command","detail":""}'::jsonb, 'JSON null envelope is rejected');
select is(test_support.library_error($q$select public.get_superadmin_question_library('{"extra":true}')$q$)->>'message',
  'invalid_command', 'Unknown list keys remain invalid');
select is(test_support.library_error($q$select public.get_superadmin_question_library('{"page":"invalid","status":"invalid"}')$q$),
  '{"sqlstate":"22P02","message":"invalid input syntax for type integer: \"invalid\"","detail":""}'::jsonb,
  'Pagination casts still precede envelope validation');

insert into test_support.library_results(label, input) values ('create', jsonb_build_object(
  'idempotencyKey', 'library-create-reference', 'reason', 'Reference',
  'document', test_support.library_document('library-command-reference')));
update test_support.library_results set result = public.create_superadmin_question_draft(input) where label = 'create';
select is((select result->'versions'->0->>'status' from test_support.library_results where label = 'create'), 'draft', 'Create returns a draft');
select is((select public.create_superadmin_question_draft(input) from test_support.library_results where label = 'create'),
  (select result from test_support.library_results where label = 'create'), 'Create replays exactly');
select is(test_support.library_error($q$select public.create_superadmin_question_draft(input || '{"reason":"Changed"}')
  from test_support.library_results where label = 'create'$q$),
  '{"sqlstate":"40001","message":"idempotency_conflict","detail":""}'::jsonb, 'Create detects key reuse');

insert into test_support.library_results(label, input)
select 'update', jsonb_build_object('idempotencyKey', 'library-update-reference', 'reason', 'Reference',
  'questionVersionId', result->'versions'->0->'questionVersionId',
  'expectedUpdatedAt', result->'versions'->0->'updatedAt',
  'document', jsonb_set(test_support.library_document('library-command-reference'), '{timeLimitMs}', '45000'))
from test_support.library_results where label = 'create';
select is(test_support.library_error($q$select public.update_superadmin_question_draft(input || '{"expectedUpdatedAt":"2000-01-01T00:00:00Z"}')
  from test_support.library_results where label = 'update'$q$)->>'message', 'content_conflict', 'Update checks its optimistic timestamp');
update test_support.library_results set result = public.update_superadmin_question_draft(input) where label = 'update';
select is((select result->'versions'->0->>'timeLimitMs' from test_support.library_results where label = 'update'), '45000', 'Update preserves document edits');
select is((select public.update_superadmin_question_draft(input) from test_support.library_results where label = 'update'),
  (select result from test_support.library_results where label = 'update'), 'Update replays exactly');
select is(test_support.library_error($q$select public.update_superadmin_question_draft(input || '{"reason":"Changed"}')
  from test_support.library_results where label = 'update'$q$),
  '{"sqlstate":"40001","message":"idempotency_conflict","detail":""}'::jsonb, 'Update detects key reuse');

insert into test_support.library_results(label, input)
select 'publish', jsonb_build_object('idempotencyKey', 'library-publish-reference', 'reason', 'Reference',
  'questionVersionId', result->'versions'->0->'questionVersionId', 'expectedUpdatedAt', result->'versions'->0->'updatedAt')
from test_support.library_results where label = 'update';
select is(test_support.library_error($q$select public.publish_superadmin_question(input || '{"expectedUpdatedAt":"2000-01-01T00:00:00Z"}')
  from test_support.library_results where label = 'publish'$q$),
  '{"sqlstate":"40001","message":"content_conflict","detail":""}'::jsonb, 'Publish checks its optimistic timestamp');
update test_support.library_results set result = public.publish_superadmin_question(input) where label = 'publish';
select is((select result->'versions'->0->>'status' from test_support.library_results where label = 'publish'), 'published', 'Publish returns published content');
select is((select public.publish_superadmin_question(input) from test_support.library_results where label = 'publish'),
  (select result from test_support.library_results where label = 'publish'), 'Publish replays exactly');
select is(test_support.library_error($q$select public.publish_superadmin_question(input || '{"reason":"Changed"}')
  from test_support.library_results where label = 'publish'$q$),
  '{"sqlstate":"40001","message":"idempotency_conflict","detail":""}'::jsonb, 'Publish detects key reuse');
select is(test_support.library_error($q$select public.publish_superadmin_question(input || '{"idempotencyKey":"library-publish-again","expectedUpdatedAt":"2000-01-01T00:00:00Z"}')
  from test_support.library_results where label = 'publish'$q$)->>'message', 'content_already_published', 'Published-state error precedes stale timestamp');

insert into test_support.library_results(label, input)
select 'archive', jsonb_build_object('idempotencyKey', 'library-archive-reference', 'reason', 'Reference',
  'questionVersionId', result->'versions'->0->'questionVersionId', 'expectedUpdatedAt', result->'versions'->0->'updatedAt')
from test_support.library_results where label = 'publish';
select is(test_support.library_error($q$select public.archive_superadmin_question(input || '{"expectedUpdatedAt":"2000-01-01T00:00:00Z"}')
  from test_support.library_results where label = 'archive'$q$),
  '{"sqlstate":"40001","message":"content_conflict","detail":""}'::jsonb, 'Archive checks its optimistic timestamp');
update test_support.library_results set result = public.archive_superadmin_question(input) where label = 'archive';
select is((select result->'versions'->0->>'status' from test_support.library_results where label = 'archive'), 'archived', 'Archive returns archived content');
select is((select public.archive_superadmin_question(input) from test_support.library_results where label = 'archive'),
  (select result from test_support.library_results where label = 'archive'), 'Archive replays exactly');
select is(test_support.library_error($q$select public.archive_superadmin_question(input || '{"reason":"Changed"}')
  from test_support.library_results where label = 'archive'$q$),
  '{"sqlstate":"40001","message":"idempotency_conflict","detail":""}'::jsonb, 'Archive detects key reuse');
select is((select count(*) from private.audit_log where request_id like 'library-%-reference'), 4::bigint,
  'Four commands and their replays produce exactly four audit events');
select is((select count(*) from private.command_requests where idempotency_key like 'library-%-reference'), 4::bigint,
  'Four commands persist exactly four idempotency results');
select ok((select bool_and(result = (select request.result from private.command_requests request
  where request.actor_id = test_support.id('superadmin') and request.idempotency_key = saved.input->>'idempotencyKey'))
  from test_support.library_results saved where input is not null), 'All responses equal their stored replay result');

select is(test_support.library_error($q$select public.create_superadmin_question_draft('{}')$q$),
  '{"sqlstate":"22023","message":"invalid_command","detail":""}'::jsonb, 'Missing create fields remain invalid');
select is(test_support.library_error($q$select public.create_superadmin_question_draft('null')$q$),
  '{"sqlstate":"22023","message":"invalid_command","detail":""}'::jsonb, 'JSON null create envelope remains invalid');
select is(test_support.library_error('select public.create_superadmin_question_draft(null)'),
  '{"sqlstate":"22023","message":"invalid_command","detail":""}'::jsonb, 'SQL null create envelope remains invalid');
select is(test_support.library_error($q$select public.update_superadmin_question_draft(input - 'expectedUpdatedAt')
  from test_support.library_results where label = 'update'$q$)->>'message', 'invalid_command', 'Absent update timestamp remains invalid');
select is(test_support.library_error($q$select public.archive_superadmin_question(input || '{"expectedUpdatedAt":null,"idempotencyKey":"library-archive-null"}')
  from test_support.library_results where label = 'archive'$q$)->>'message', 'content_not_published', 'State check still precedes a JSON null timestamp');
select is(test_support.library_error($q$select public.publish_superadmin_question(input || '{"idempotencyKey":"library-publish-archived"}')
  from test_support.library_results where label = 'publish'$q$)->>'message', 'content_not_draft', 'Archived versions remain unpublishable');
select is(test_support.library_error($q$select public.create_superadmin_question_draft(input || '{"idempotencyKey":"library-create-slug-conflict"}')
  from test_support.library_results where label = 'create'$q$)->>'message', 'content_slug_conflict', 'Duplicate slugs retain their error');
select is(test_support.library_error($q$select public.create_superadmin_question_draft(input || '{"questionDefinitionId":"00000000-0000-0000-0000-000000000000","idempotencyKey":"library-create-missing"}')
  from test_support.library_results where label = 'create'$q$)->>'message', 'content_not_found', 'Missing definition retains its error');
select is(public.get_superadmin_question_version(test_support.id('qv-normal'))->'versions'->0->>'usageCount', '3',
  'Detail counts references from three challenges using the same version');
select ok((select bool_and((result->'versions'->0->>'createdAt')::timestamptz <=
  (result->'versions'->0->>'updatedAt')::timestamptz) from test_support.library_results where label in ('create','update','publish','archive')),
  'Generated timestamps preserve creation/update ordering');

insert into test_support.library_results(label, result) values ('rollback-draft',
  public.create_superadmin_question_draft(jsonb_build_object('idempotencyKey','library-rollback-draft','reason','Reference',
    'document',test_support.library_document('library-rollback-draft'))));
insert into test_support.library_results(label, result) values ('rollback-published',
  public.create_superadmin_question_draft(jsonb_build_object('idempotencyKey','library-rollback-published','reason','Reference',
    'document',test_support.library_document('library-rollback-published'))));
update test_support.library_results set result = public.publish_superadmin_question(jsonb_build_object(
  'idempotencyKey','library-rollback-publish','reason','Reference','questionVersionId',result->'versions'->0->'questionVersionId',
  'expectedUpdatedAt',result->'versions'->0->'updatedAt')) where label = 'rollback-published';
insert into test_support.library_results(label, input)
select 'rollback-update', jsonb_build_object('idempotencyKey','library-audit-fail-update','reason','Reference',
  'questionVersionId',result->'versions'->0->'questionVersionId','expectedUpdatedAt',result->'versions'->0->'updatedAt',
  'document',jsonb_set(test_support.library_document('library-rollback-draft'), '{solutionPayload,correctAnswer}', 'false'))
from test_support.library_results where label = 'rollback-draft';
insert into test_support.library_results(label, input)
select 'rollback-publish', jsonb_build_object('idempotencyKey','library-audit-fail-publish','reason','Reference',
  'questionVersionId',result->'versions'->0->'questionVersionId','expectedUpdatedAt',result->'versions'->0->'updatedAt')
from test_support.library_results where label = 'rollback-draft';
insert into test_support.library_results(label, input)
select 'rollback-archive', jsonb_build_object('idempotencyKey','library-audit-fail-archive','reason','Reference',
  'questionVersionId',result->'versions'->0->'questionVersionId','expectedUpdatedAt',result->'versions'->0->'updatedAt')
from test_support.library_results where label = 'rollback-published';
create function test_support.library_snapshot() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'definitions', (select jsonb_agg(to_jsonb(t) order by id) from private.question_definitions t),
    'versions', (select jsonb_agg(to_jsonb(t) order by id) from private.question_versions t),
    'solutions', (select jsonb_agg(to_jsonb(t) order by question_version_id) from private.question_version_solutions t),
    'audit', (select jsonb_agg(to_jsonb(t) order by id) from private.audit_log t),
    'requests', (select jsonb_agg(to_jsonb(t) order by actor_id, idempotency_key) from private.command_requests t))
$$;
insert into test_support.library_results(label, result) values ('before-audit-failures', test_support.library_snapshot());

-- A real failing audit insert must undo all writes, including private solutions.
create function test_support.reject_library_audit() returns trigger language plpgsql as $$
begin raise exception 'library_audit_rejected' using errcode = '23514', detail = 'fixture audit rejection'; end;
$$;
create trigger reject_library_audit before insert on private.audit_log for each row
  when (new.request_id like 'library-audit-fail-%') execute function test_support.reject_library_audit();
select is(test_support.library_error($q$select public.create_superadmin_question_draft(jsonb_build_object(
  'idempotencyKey','library-audit-fail-create','reason','Reference','document',test_support.library_document('library-audit-failed')))$q$),
  '{"sqlstate":"23514","message":"library_audit_rejected","detail":"fixture audit rejection"}'::jsonb,
  'Audit errors retain SQLSTATE, message and detail');
select is((select count(*) from private.question_definitions where slug = 'library-audit-failed'), 0::bigint,
  'Audit failure rolls back definition, versions and solutions');
select is((select count(*) from private.command_requests where idempotency_key like 'library-audit-fail-%'), 0::bigint,
  'Audit failure leaves no idempotency result');
select is(test_support.library_error(format('select public.%I(%L::jsonb)', operation, input)),
  '{"sqlstate":"23514","message":"library_audit_rejected","detail":"fixture audit rejection"}'::jsonb,
  operation || ' rolls back when audit fails')
from (values ('rollback-update','update_superadmin_question_draft'), ('rollback-publish','publish_superadmin_question'),
  ('rollback-archive','archive_superadmin_question')) commands(label, operation)
join test_support.library_results saved using (label);
select is(test_support.library_snapshot(), (select result from test_support.library_results where label = 'before-audit-failures'),
  'Audit failures preserve every row and timestamp for all four commands');

select * from finish();
rollback;
