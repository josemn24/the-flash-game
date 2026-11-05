begin;
set local search_path=public,extensions;
select no_plan();
-- @command-fixtures
select test_support.as_actor('superadmin');
create temp table difficulty_results(label text, result jsonb);
insert into difficulty_results values('created',private.create_question_draft_command(jsonb_build_object(
  'idempotencyKey','difficulty-create-question','reason','Clasificación explícita',
  'document',jsonb_build_object('slug','difficulty-explicit','type','true-false','payloadSchemaVersion',1,'timeLimitMs',15000,
    'difficulty','hard','publicPayload',jsonb_build_object('question','Un hexágono tiene seis lados.'),'solutionPayload',jsonb_build_object('correctAnswer',true)))));
select is((select result#>>'{versions,0,document,difficulty}' from difficulty_results where label='created'),'hard','standalone stores explicit difficulty');
insert into difficulty_results select 'updated',private.update_question_draft_command(jsonb_build_object(
  'idempotencyKey','difficulty-update-question','reason','Ajuste editorial','questionVersionId',result#>>'{versions,0,questionVersionId}',
  'expectedUpdatedAt',result#>>'{versions,0,updatedAt}',
  'document',(result#>'{versions,0,document}')||'{"difficulty":"easy"}'::jsonb)) from difficulty_results where label='created';
select is((select result#>>'{versions,0,document,difficulty}' from difficulty_results where label='updated'),'easy','draft difficulty is editable');
select is((select result#>>'{versions,0,document,publicPayload,question}' from difficulty_results where label='updated'),'Un hexágono tiene seis lados.','difficulty does not alter format content');
select lives_ok($$select private.validate_flash_question_document('{"slug":"legacy-default","type":"true-false","payloadSchemaVersion":1,"timeLimitMs":1000,"publicPayload":{"question":"Dos es par."},"solutionPayload":{"correctAnswer":true}}')$$,'legacy documents without difficulty remain valid');
select throws_ok($$select private.validate_flash_question_document('{"slug":"invalid-difficulty","type":"true-false","difficulty":"extreme","payloadSchemaVersion":1,"timeLimitMs":1000,"publicPayload":{"question":"Dos es par."},"solutionPayload":{"correctAnswer":true}}')$$,'22023','invalid_content','unknown difficulty is rejected');
select ok((select bool_and(difficulty='medium') from private.question_versions where id<>((select result#>>'{versions,0,questionVersionId}' from difficulty_results where label='created'))::uuid),'preexisting rows remain medium');
select * from finish();
rollback;
