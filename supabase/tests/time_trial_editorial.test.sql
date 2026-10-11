begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures

create function test_support.ct_document(n integer default 2) returns jsonb language sql as $$
  select jsonb_build_object('challenge',jsonb_build_object(
    'slug','ct-editorial','title','Contrarreloj','subtitle','','description','',
    'mode','time-trial','configSchemaVersion',1,'modeConfig','{}'::jsonb,'globalTimeLimitMs',60000),
    'questions',(select jsonb_agg(private.question_version_document(test_support.id('pyramid-queens-qv'))
      || jsonb_build_object('slug','ct-board-'||p,'points',case when n=2 then 50 else 5 end) order by p)
      from generate_series(1,n) p))
$$;
select lives_ok($$select private.validate_flash_editorial_document(test_support.ct_document(2))$$,'Two Queens boards publish');
select lives_ok($$select private.validate_flash_editorial_document(test_support.ct_document(20))$$,'Twenty Queens boards publish');
select throws_ok($$select private.validate_flash_editorial_document(test_support.ct_document(1))$$,'22023','incomplete_content','One board is rejected');
select throws_ok($$select private.validate_flash_editorial_document(test_support.ct_document(21))$$,'22023','incomplete_content','Twenty-one boards are rejected');
select throws_ok($$select private.validate_flash_editorial_document(test_support.ct_document()#-'{challenge,globalTimeLimitMs}'::text[])$$,'22023','invalid_content','Duration is mandatory');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{challenge,globalTimeLimitMs}','0'))$$,'22023','invalid_content','Zero duration is rejected');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{challenge,globalTimeLimitMs}','1500'))$$,'22023','invalid_content','Duration must represent whole seconds');
select lives_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{challenge,globalTimeLimitMs}','2147483000'))$$,'The largest whole-second duration fits the existing integer');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{questions,0,points}','0'))$$,'22023','invalid_content','Weights must be positive');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{questions,0,points}','49.5'))$$,'22023','invalid_content','Weights must be integers');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{questions,0,points}','49'))$$,'22023','points_total_invalid','Weights must sum to exactly 100');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{questions,0,type}','"true-false"'))$$,'22023','unsupported_question','Other formats are rejected before publication');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.ct_document(),'{questions,0,solutionPayload,solution}','[0,1,2,3,4]'))$$,'22023','invalid_public_payload','Invalid Queens solutions are rejected');
select throws_ok($$update private.challenge_versions set global_time_limit_ms=120000 where id=test_support.id('ct-cv-1')$$,'P0001','Published content is immutable; create another version','Published duration is frozen');
select throws_ok($$update private.challenge_items set points=29 where id=test_support.id('ct-item-1-1')$$,'P0001','Published children are immutable','Published scoring is frozen');
select throws_ok($$update private.challenge_items set position=3 where id=test_support.id('ct-item-1-1')$$,'P0001','Published children are immutable','Published sequence is frozen');
select throws_ok($$update private.question_version_solutions set solution_payload='{}' where question_version_id=test_support.id('pyramid-queens-qv')$$,'P0001','Published children are immutable','Published solutions are frozen');

-- Direct SQL publication also enforces the mode-wide contract.
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
values(test_support.id('ct-invalid-cv'),test_support.id('ct-cd'),3,'time-trial','Invalid',60000,test_support.id('owner'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
values(test_support.id('ct-invalid-item'),test_support.id('ct-invalid-cv'),test_support.id('pyramid-queens-qv'),1,100);
select throws_ok($$update private.challenge_versions set status='published' where id=test_support.id('ct-invalid-cv')$$,'22023','invalid_time_trial_content','Direct publication cannot bypass the board count');
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
values(test_support.id('ct-invalid-item-2'),test_support.id('ct-invalid-cv'),test_support.id('pyramid-queens-timeout-qv'),2,1);
select throws_ok($$update private.challenge_versions set status='published' where id=test_support.id('ct-invalid-cv')$$,'P0001','Challenge items must sum to 100 points','Direct publication cannot bypass the scoring total');
update private.challenge_items set points=99 where id=test_support.id('ct-invalid-item');
select lives_ok($$update private.challenge_versions set status='published' where id=test_support.id('ct-invalid-cv')$$,'A corrected draft publishes with exact editorial weights');
select * from finish();
rollback;
