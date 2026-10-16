begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures
create function test_support.cp_public() returns jsonb language sql immutable as $$ select '{"question":"Conecta las parejas y cubre el tablero.","grid":{"rows":5,"columns":5},"pairs":[{"id":"a","label":"Pareja A","symbol":"A","endpoints":[0,4]},{"id":"b","label":"Pareja B","symbol":"B","endpoints":[5,9]},{"id":"c","label":"Pareja C","symbol":"C","endpoints":[10,14]}],"requireFullCoverage":true}'::jsonb $$;
create function test_support.cp_answer() returns jsonb language sql immutable as $$ select '{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb $$;
create function test_support.cp_alternative() returns jsonb language sql immutable as $$ select '{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,11,16,15,20,21,22,23,24,19,18,17,12,13,14]}}'::jsonb $$;
select ok(private.connect_pairs_answer_valid(test_support.cp_public(),test_support.cp_answer()),'A full-coverage board is accepted');
select ok(private.connect_pairs_answer_valid(test_support.cp_public(),test_support.cp_alternative()),'A different legal route is accepted');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'null'::jsonb),false,'Rejects missing answer');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'[]'::jsonb),false,'Rejects array answer');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{}'::jsonb),false,'Rejects missing paths');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{}}'::jsonb),false,'Rejects empty paths');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14],"d":[1,2]}}'::jsonb),false,'Rejects unknown pair');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,11,12,13,14]}}'::jsonb),false,'Rejects incomplete coverage');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,6,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects diagonal');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4,5,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects row wrapping');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4],"b":[5,0,1,2,3,4,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects overlap');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects repeated cell');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1.5,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects fraction');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[1,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects wrong endpoints');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,25],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects out of bounds');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{"a":[0,"1",2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb),false,'Rejects non numeric');
insert into private.question_definitions(id,slug,created_by_player_id)
select test_support.id('cp-qd-'||n),'cp-qd-'||n,test_support.id('owner') from generate_series(1,2) n;
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
select test_support.id('cp-qv-'||n),test_support.id('cp-qd-'||n),1,'connect-pairs',1000,test_support.cp_public(),test_support.id('owner') from generate_series(1,2) n;
insert into private.question_version_solutions(question_version_id,solution_payload)
select test_support.id('cp-qv-'||n),test_support.cp_answer() from generate_series(1,2) n;
update private.question_versions set status='published' where id in(test_support.id('cp-qv-1'),test_support.id('cp-qv-2'));
create function test_support.cp_document() returns jsonb language sql as $$
  select jsonb_build_object('challenge',jsonb_build_object('slug','cp-editorial','title','Conectar parejas','subtitle','','description','','mode','time-trial','configSchemaVersion',1,'modeConfig','{}'::jsonb,'globalTimeLimitMs',60000),
    'questions',jsonb_build_array(
      private.question_version_document(test_support.id('cp-qv-1')) || '{"points":30}'::jsonb,
      private.question_version_document(test_support.id('cp-qv-2')) || '{"points":70}'::jsonb))
$$;
select lives_ok($$select private.validate_flash_editorial_document(test_support.cp_document())$$,'Inline Connect pairs can be saved');
select lives_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0}',jsonb_build_object('source','library','questionVersionId',upper(test_support.id('cp-qv-1')::text),'points',30,'modeConfig','{}'::jsonb)))$$,'Uppercase UUID library references remain compatible');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0,solutionPayload,paths,c}','[10,11,12,13,14]'))$$,'22023','invalid_solution_payload','Incomplete editorial solutions are rejected');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0}',jsonb_build_object('source','library','questionVersionId',test_support.id('pyramid-queens-qv'),'points',30,'modeConfig','{}'::jsonb)))$$,'22023','unsupported_question','Mixed inline and library formats are rejected');
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
values(test_support.id('cp-cv'),test_support.id('ct-cd'),3,'time-trial','Conectar parejas',60000,test_support.id('owner'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('cp-item-'||n),test_support.id('cp-cv'),test_support.id('cp-qv-'||n),n,case when n=1 then 30 else 70 end from generate_series(1,2) n;
select lives_ok($$select private.assert_time_trial_content(test_support.id('cp-cv'))$$,'Homogeneous Connect pairs content is valid');
update private.challenge_items set question_version_id=test_support.id('pyramid-queens-qv') where id=test_support.id('cp-item-2');
select throws_ok($$select private.assert_time_trial_content(test_support.id('cp-cv'))$$,'22023','invalid_time_trial_content','Mixed library content is rejected');
update private.challenge_items set question_version_id=test_support.id('cp-qv-2') where id=test_support.id('cp-item-2');
select test_support.as_actor('superadmin');
select is((select (e->'document'->'challenge'->>'globalTimeLimitMs')::integer from jsonb_array_elements(public.get_superadmin_challenge_detail(test_support.id('ct-cd'))->'entries') e where e->>'challengeVersionId'=test_support.id('cp-cv')::text),60000,'Editorial detail preserves the global duration');
update private.challenge_versions set status='published' where id=test_support.id('cp-cv');
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
values(test_support.id('cp-short-cv'),test_support.id('ct-cd'),4,'time-trial','Conectar parejas corto',1000,test_support.id('owner'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('cp-short-item-'||n),test_support.id('cp-short-cv'),test_support.id('cp-qv-'||n),n,case when n=1 then 30 else 70 end from generate_series(1,2) n;
update private.challenge_versions set status='published' where id=test_support.id('cp-short-cv');
insert into public.rooms(id,slug,title) select test_support.id('cp-room-'||n),'cp-room-'||n,'Conectar parejas' from generate_series(1,6) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('cp-room-'||n),m.player_id,m.role from public.room_memberships m cross join generate_series(1,6) n where m.room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('cp-season-'||n),test_support.id('cp-room-'||n),'CP','active',now()-interval '1 day',now()+interval '1 day' from generate_series(1,6) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('cp-sc-'||n),test_support.id('cp-season-'||n),test_support.id(case when n>=4 then 'cp-short-cv' else 'cp-cv' end),1,'open',now()-interval '1 hour',now()+interval '1 day' from generate_series(1,6) n;
create function test_support.start_cp(n integer) returns jsonb language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('cp-sc-'||n),'sessionToken',gen_random_uuid()::text));
  return test_support.run('prepare_interaction');
end;
$$;
grant execute on function test_support.start_cp(integer),test_support.cp_public(),test_support.cp_answer(),test_support.cp_alternative() to service_role;
grant select on test_support.runtime to authenticated;
select test_support.as_actor('owner');
set local role authenticated;
select is((select can_start from public.get_room_calendar('cp-room-1')),true,'Calendar admits Connect pairs');
select is((select question_type from public.get_my_time_trial_challenge('cp-room-1',test_support.id('cp-sc-1')) limit 1),'connect-pairs','The competitive read returns Connect pairs metadata');
reset role;
set local role service_role;
select test_support.start_cp(1);
select throws_ok($$select test_support.run('receive_answer','{"answer":{"paths":{}}}')$$,'22023','invalid_connect_pairs_answer','Incomplete paths do not consume the interaction');
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_alternative()));
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Submission retries are idempotent');
select test_support.run('record_evaluation','{"status":"correct","points":1}');
select is((select last_result->'points' from test_support.runtime),'30'::jsonb,'The full first weight is awarded without speed adjustment');
select test_support.run('recover_attempt');
select test_support.run('prepare_interaction');
reset role;
select is((select count(distinct deadline_at) from private.attempt_timing_units where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Both boards share one deadline');
select is((select count(*) from private.queens_validation_events where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),0::bigint,'Connect pairs creates no Queens error events');
set local role service_role;
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select test_support.run('record_evaluation','{"status":"correct","points":1}');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','all_solved','All boards complete the challenge');
select is((select last_result->'score' from test_support.runtime),'100'::jsonb,'The total is 100');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Completion retries are idempotent');
reset role;
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime) and entry_type='accreditation'),1::bigint,'Exactly one accreditation is persisted');
set local role service_role;
select test_support.start_cp(2);
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select test_support.run('record_evaluation','{"status":"correct","points":30}');
select test_support.run('prepare_interaction');
select test_support.run('recover_attempt');
select test_support.run('record_evaluation','{"status":"unanswered","points":0}');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','recovery_interrupted','Recovering an active board ends the attempt');
select is((select last_result->'score' from test_support.runtime),'30'::jsonb,'Recovery preserves previously earned points');
select test_support.start_cp(3);
select test_support.run('recover_attempt');
select test_support.run('record_evaluation','{"status":"unanswered","points":0}');
select test_support.run('complete_attempt');
reset role;
set local role authenticated;
select is((select public_payload from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=2),null::jsonb,'Review hides unreached boards');
select is((select solution_payload from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=2),null::jsonb,'Review hides unreached solutions');
reset role;
set local role service_role;
select test_support.start_cp(4);
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select pg_sleep(1.05);
select test_support.run('record_evaluation','{"status":"correct","points":30}');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','time_limit','An intermediate timely answer survives late evaluation');
select is((select last_result->'score' from test_support.runtime),'30'::jsonb,'The timely board keeps its weight');
select test_support.start_cp(5);
select pg_sleep(1.05);
select throws_ok($$select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()))$$,'55000','deadline_reached','Late complete routes are rejected');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','time_limit','Timeout completes an unsolved board');
select test_support.start_cp(6);
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select test_support.run('record_evaluation','{"status":"correct","points":30}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_alternative()));
select pg_sleep(1.05);
select test_support.run('record_evaluation','{"status":"correct","points":70}');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','all_solved','A timely final route wins over late evaluation');
reset role;
select * from finish();
rollback;
