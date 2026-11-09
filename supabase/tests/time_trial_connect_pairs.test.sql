begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures
-- @time-trial-fixtures
create function test_support.cp_public() returns jsonb language sql immutable as $$ select '{"question":"Conecta las parejas y cubre el tablero.","grid":{"rows":5,"columns":5},"pairs":[{"id":"a","label":"Pareja A","symbol":"A","endpoints":[0,4]},{"id":"b","label":"Pareja B","symbol":"B","endpoints":[5,9]},{"id":"c","label":"Pareja C","symbol":"C","endpoints":[10,14]}],"requireFullCoverage":true}'::jsonb $$;
create function test_support.cp_answer() returns jsonb language sql immutable as $$ select '{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,15,20,21,22,23,24,19,18,17,16,11,12,13,14]}}'::jsonb $$;
create function test_support.cp_alternative() returns jsonb language sql immutable as $$ select '{"paths":{"a":[0,1,2,3,4],"b":[5,6,7,8,9],"c":[10,11,16,15,20,21,22,23,24,19,18,17,12,13,14]}}'::jsonb $$;
create function test_support.cp_square(board_size integer) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'public', jsonb_build_object(
      'question', 'Conecta las parejas y cubre el tablero.',
      'grid', jsonb_build_object('rows', board_size, 'columns', board_size),
      'pairs', (select jsonb_agg(jsonb_build_object(
        'id', 'pair-'||generated_row,
        'label', 'Pareja '||generated_row,
        'symbol', generated_row::text,
        'endpoints', jsonb_build_array((generated_row-1)*board_size, generated_row*board_size-1)
      ) order by generated_row) from generate_series(1,board_size) as pair_rows(generated_row)),
      'requireFullCoverage', true
    ),
    'answer', jsonb_build_object('paths', (
      select jsonb_object_agg('pair-'||generated_row, (
        select jsonb_agg((generated_row-1)*board_size+generated_column order by generated_column)
        from generate_series(0,board_size-1) as path_columns(generated_column)
      )) from generate_series(1,board_size) as path_rows(generated_row)
    ))
  )
$$;
select ok(private.connect_pairs_answer_valid(test_support.cp_public(),test_support.cp_answer()),'A full-coverage board is accepted');
select ok(private.connect_pairs_answer_valid(test_support.cp_public(),test_support.cp_alternative()),'A different legal route is accepted');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'null'::jsonb),false,'Rejects missing answer');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'[]'::jsonb),false,'Rejects array answer');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{}'::jsonb),false,'Rejects missing paths');
select is(private.connect_pairs_answer_valid(test_support.cp_public(),'{"paths":{}}'::jsonb),false,'Rejects empty paths');
select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2]}}'::jsonb),
  'Accepts a validated open route as a review draft');
select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{}}'::jsonb),
  'Accepts an empty checkpoint without treating it as a completed answer');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,6]}}'::jsonb),false,
  'Rejects a diagonal review route');

select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0]}}'), 'Accepts the initial endpoint as a draft');
select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[4]}}'), 'Accepts a single endpoint in reverse direction');
select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[],"b":[5]}}'), 'Accepts empty routes alongside a single endpoint');
select ok(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4],"b":[5]}}'), 'Accepts a full route alongside a single endpoint');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,1,0]}}'),false,'A single-endpoint allowance does not permit repeated cells');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,5]}}'),false,'Rejects using another pair endpoint');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,1,2,3,4,9]}}'),false,'Rejects continuing past the closing endpoint');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[0,1,6],"b":[5,6]}}'),false,'Rejects overlapping draft routes');
select is(private.connect_pairs_draft_valid(test_support.cp_public(),'{"paths":{"a":[25]}}'),false,'Rejects an endpoint outside the board');

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
select ok((select bool_and(private.connect_pairs_answer_valid(payload->'public',payload->'answer'))
  from generate_series(4,8) as sizes(board_size)
  cross join lateral (select test_support.cp_square(board_size) payload) square),
  'Accepts valid full-coverage solutions with the maximum pair count for every supported size');
select lives_ok(format('select private.validate_connect_pairs_question_document(%L::jsonb)',
  jsonb_build_object('publicPayload', payload->'public', 'solutionPayload', payload->'answer')::text),
  format('Editorial content validation accepts a %s×%s board', board_size, board_size))
  from generate_series(4,8) as sizes(board_size)
  cross join lateral (select test_support.cp_square(board_size) payload) square;
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{grid,columns}','5'::jsonb),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects rectangular boards');
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{grid,rows}','3'::jsonb),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects sizes below 4');
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{grid,rows}','9'::jsonb),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects sizes above 8');
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{pairs}',
    (test_support.cp_square(4)->'public'->'pairs')||jsonb_build_array(
      jsonb_build_object('id','pair-extra','label','Extra','symbol','X','endpoints',jsonb_build_array(1,2)))),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects pair counts above the board side');
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{pairs}',jsonb_build_array(
    test_support.cp_square(4)->'public'->'pairs'->0,test_support.cp_square(4)->'public'->'pairs'->1)),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects fewer than three pairs');
select throws_ok($$select private.validate_connect_pairs_question_document(jsonb_build_object(
  'publicPayload',jsonb_set(test_support.cp_square(4)->'public','{pairs,3,endpoints,1}','16'::jsonb),
  'solutionPayload',test_support.cp_square(4)->'answer'))$$,
  '22023','invalid_public_payload','Editorial validation rejects endpoints outside the board');
select is(private.connect_pairs_answer_valid(
  jsonb_set((test_support.cp_square(4)->'public'),'{grid,columns}','5'::jsonb),
  test_support.cp_square(4)->'answer'),false,'Rejects rectangular boards');
select is(private.connect_pairs_answer_valid(
  jsonb_set(jsonb_set((test_support.cp_square(4)->'public'),'{grid,rows}','3'::jsonb),'{grid,columns}','3'::jsonb),
  test_support.cp_square(4)->'answer'),false,'Rejects boards smaller than 4×4');
select is(private.connect_pairs_answer_valid(
  jsonb_set(jsonb_set((test_support.cp_square(4)->'public'),'{grid,rows}','9'::jsonb),'{grid,columns}','9'::jsonb),
  test_support.cp_square(4)->'answer'),false,'Rejects boards larger than 8×8');
select is(private.connect_pairs_answer_valid(
  jsonb_set(test_support.cp_square(4)->'public','{pairs}',
    (test_support.cp_square(4)->'public'->'pairs')||jsonb_build_array(
      jsonb_build_object('id','pair-extra','label','Extra','symbol','X','endpoints',jsonb_build_array(1,2)))),
  test_support.cp_square(4)->'answer'),false,'Rejects more pairs than the board side');
select is(private.connect_pairs_answer_valid(test_support.cp_square(4)->'public',
  jsonb_set(test_support.cp_square(4)->'answer','{paths,pair-4,3}','16'::jsonb)),false,'Rejects an index beyond a 4×4 board');
select is(private.connect_pairs_answer_valid(test_support.cp_square(4)->'public',
  jsonb_set(test_support.cp_square(4)->'answer','{paths,pair-1}', '[0,1,2,3,4]'::jsonb)),
  false,'Rejects row wrapping on a 4×4 board');
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
select lives_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),
  '{challenge,modeConfig}', '{"connectPairsTimeoutPartialCredit":true}'))$$,
  'Inline Connect pairs can opt in to timeout credit');
select lives_ok($$select private.validate_flash_editorial_document(jsonb_set(jsonb_set(test_support.cp_document(),
  '{challenge,modeConfig}', '{"connectPairsTimeoutPartialCredit":true}'), '{questions,0}',
  jsonb_build_object('source','library','questionVersionId',test_support.id('cp-qv-1'),'points',30,'modeConfig','{}'::jsonb)))$$,
  'Library Connect pairs can opt in to timeout credit');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),
  '{challenge,modeConfig}', '{"queensTimeoutPartialCredit":true}'))$$,
  '22023','unsupported_question','Connect pairs cannot opt in to Queens timeout credit');
select lives_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0}',jsonb_build_object('source','library','questionVersionId',upper(test_support.id('cp-qv-1')::text),'points',30,'modeConfig','{}'::jsonb)))$$,'Uppercase UUID library references remain compatible');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0,solutionPayload,paths,c}','[10,11,12,13,14]'))$$,'22023','invalid_solution_payload','Incomplete editorial solutions are rejected');
select throws_ok($$select private.validate_flash_editorial_document(jsonb_set(test_support.cp_document(),'{questions,0}',jsonb_build_object('source','library','questionVersionId',test_support.id('pyramid-queens-qv'),'points',30,'modeConfig','{}'::jsonb)))$$,'22023','unsupported_question','Mixed inline and library formats are rejected');
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
values(test_support.id('cp-cv'),test_support.id('ct-cd'),3,'time-trial','Conectar parejas',60000,test_support.id('owner'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('cp-item-'||n),test_support.id('cp-cv'),test_support.id('cp-qv-'||n),n,case when n=1 then 30 else 70 end from generate_series(1,2) n;
select lives_ok($$select private.assert_time_trial_content(test_support.id('cp-cv'))$$,'Homogeneous Connect pairs content is valid');
update private.challenge_versions set mode_config='{"queensTimeoutPartialCredit":true}' where id=test_support.id('cp-cv');
select throws_ok($$update private.challenge_versions set status='published' where id=test_support.id('cp-cv')$$,
  '22023','invalid_time_trial_content','Published Connect pairs references cannot opt in');
update private.challenge_versions set mode_config='{}' where id=test_support.id('cp-cv');
select throws_ok($$update private.challenge_versions set status='published',
  mode_config='{"queensTimeoutPartialCredit":true}' where id=test_support.id('cp-cv')$$,
  '22023','invalid_time_trial_content','Publishing cannot bypass validation by changing the draft config in the same write');
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
insert into public.rooms(id,slug,title) select test_support.id('cp-room-'||n),'cp-room-'||n,'Conectar parejas' from generate_series(1,7) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('cp-room-'||n),m.player_id,m.role from public.room_memberships m cross join generate_series(1,7) n where m.room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('cp-season-'||n),test_support.id('cp-room-'||n),'CP','active',now()-interval '1 day',now()+interval '1 day' from generate_series(1,7) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('cp-sc-'||n),test_support.id('cp-season-'||n),test_support.id(case when n>=4 then 'cp-short-cv' else 'cp-cv' end),1,'open',now()-interval '1 hour',now()+interval '1 day' from generate_series(1,7) n;
create function test_support.start_cp(n integer) returns jsonb language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('cp-sc-'||n),'sessionToken',gen_random_uuid()::text));
  return test_support.run('prepare_interaction');
end;
$$;
insert into private.challenge_definitions(id,slug,created_by_player_id)
values(test_support.id('cp-flash-cd'),'cp-flash-timeout',test_support.id('owner'));
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id)
values(test_support.id('cp-flash-cv'),test_support.id('cp-flash-cd'),1,'flash','Connect Pairs timeout',test_support.id('owner'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('cp-flash-item-'||n),test_support.id('cp-flash-cv'),test_support.id('cp-qv-'||n),n,50
from generate_series(1,2) n;
update private.challenge_versions set status='published' where id=test_support.id('cp-flash-cv');
insert into public.rooms(id,slug,title) values(test_support.id('cp-flash-room'),'cp-flash-timeout','Connect Pairs timeout');
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('cp-flash-room'),player_id,role from public.room_memberships where room_id=test_support.id('room-flash');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('cp-flash-season'),test_support.id('cp-flash-room'),'CP timeout','active',now()-interval '1 day',now()+interval '1 day');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('cp-flash-sc'),test_support.id('cp-flash-season'),test_support.id('cp-flash-cv'),1,'open',now()-interval '1 hour',now()+interval '1 day');
create function test_support.start_cp_flash() returns jsonb language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('cp-flash-sc'),'sessionToken',gen_random_uuid()::text));
  return test_support.run('prepare_interaction');
end;
$$;
grant execute on function test_support.start_cp(integer),test_support.start_cp_flash(),test_support.cp_public(),test_support.cp_answer(),test_support.cp_alternative() to service_role;
grant select on test_support.runtime to authenticated;
select test_support.as_actor('owner');
set local role authenticated;
select is((select can_start from public.get_room_calendar('cp-room-1')),true,'Calendar admits Connect pairs');
select is((select question_type from public.get_my_time_trial_challenge('cp-room-1',test_support.id('cp-sc-1')) limit 1),'connect-pairs','The competitive read returns Connect pairs metadata');
reset role;
set local role service_role;
select test_support.start_cp(1);
select throws_ok($$select test_support.run('receive_answer','{"answer":{"paths":{}}}')$$,'22023','invalid_connect_pairs_answer','Incomplete paths do not consume the interaction');
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1]}}');
select test_support.run('receive_answer',jsonb_build_object(
  'answer',test_support.cp_alternative(),
  'lockVersion',(select (state->>'lockVersion')::bigint-1 from test_support.runtime)));
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Submission retries are idempotent');
select test_support.run('record_evaluation','{"status":"correct","points":1}');
select is((select last_result->'status' from test_support.runtime),'"correct"'::jsonb,
  'An authoritative complete CP answer accepts the preceding checkpoint version');
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
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2]}}');
select throws_ok($$select test_support.run('complete_attempt',jsonb_build_object(
  'lockVersion',(select (state->>'lockVersion')::bigint-1 from test_support.runtime)))$$,
  '40001','stale_version','A stale browser version cannot close Contrarreloj before its deadline');
select pg_sleep(1.05);
select throws_ok($$select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()))$$,'55000','deadline_reached','Late complete routes are rejected');
select is((test_support.run('complete_attempt',jsonb_build_object(
  'lockVersion',(select (state->>'lockVersion')::bigint-1 from test_support.runtime)))->'timeTrial'->>'endReason'),
  'time_limit','A stale browser version still closes an authorized expired Contrarreloj');
select is((select status from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-short-item-1')),'unanswered','A timed-out partial draft remains unscored');
select is((select answer from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-short-item-1')),null::jsonb,'A draft never becomes a scored answer');
select is((select points from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-short-item-1')),0,'A timed-out partial draft preserves current scoring');
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-short-item-1')),
  '{"type":"connect-pairs","paths":{"a":[0,1,2]}}'::jsonb,'Timeout stores the last accepted CP draft separately');
select throws_ok($$select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1]}}')$$,
  '42501','session_revoked','A checkpoint arriving after terminal closure is rejected');
reset role;
set local role authenticated;
select is((select review_state from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime))
  where item_position=1),'{"type":"connect-pairs","paths":{"a":[0,1,2]}}'::jsonb,
  'The authorized time-trial result read exposes the saved draft');
reset role;
set local role service_role;
select test_support.start_cp(7);
select test_support.run('save_connect_pairs_draft','{"paths":{}}');
select pg_sleep(1.05);
select test_support.run('complete_attempt');
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-short-item-1')),null::jsonb,'An empty checkpoint remains Sin responder');
select test_support.start_cp_flash();
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2]}}');
select is((select progress_payload->'paths' from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"a":[0,1,2]}'::jsonb,'The per-board checkpoint is persisted on the active attempt');
select pg_sleep(1.05);
select test_support.run('receive_answer',jsonb_build_object(
  'answer',null::jsonb,
  'lockVersion',(select (state->>'lockVersion')::bigint-1 from test_support.runtime)));
select is((select last_result->'timedOut' from test_support.runtime),'true'::jsonb,'Per-board timeout records the null receipt');
select is((select progress_payload->'paths' from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"a":[0,1,2]}'::jsonb,'The null receipt keeps the accepted CP checkpoint available for evaluation');
select test_support.run('record_evaluation','{"status":"unanswered","points":0}');
select is((select progress_payload->'paths' from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"a":[0,1,2]}'::jsonb,'Evaluation reads the checkpoint before any later interaction');
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and challenge_item_id=test_support.id('cp-flash-item-1')),
  '{"type":"connect-pairs","paths":{"a":[0,1,2]}}'::jsonb,'Per-board timeout captures the accepted CP checkpoint');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select test_support.run('record_evaluation','{"status":"correct","points":50}');
select test_support.run('complete_attempt');
reset role;
set local role authenticated;
select is((select review_state from public.get_my_flash_result((select (state->>'attemptId')::uuid from test_support.runtime))
  where item_position=1),'{"type":"connect-pairs","paths":{"a":[0,1,2]}}'::jsonb,
  'The reopened Flash result exposes the per-board timeout draft');
reset role;
set local role service_role;
select test_support.start_cp(6);
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_answer()));
select test_support.run('record_evaluation','{"status":"correct","points":30}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_alternative()));
select pg_sleep(1.05);
select test_support.run('record_evaluation','{"status":"correct","points":70}');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','all_solved','A timely final route wins over late evaluation');
reset role;

select test_support.as_actor('member');
set local role service_role;
select test_support.start_cp(4);
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0],"b":[5,6,7,8,9]}}');
select test_support.run('recover_attempt');
select pg_sleep(1.05);
select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->'receiptId' from test_support.runtime),'status','unanswered','points',0)));
select is((select review_state from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  '{"type":"connect-pairs","paths":{"a":[0],"b":[5,6,7,8,9]}}'::jsonb,'Completion preserves a checkpoint when evaluating a pending recovery receipt');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Pending evaluation closure replays the same result');
select is((select count(*) from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Replayed closure keeps one evaluated answer');
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Replayed closure keeps one accreditation');
reset role;
set local role authenticated;
select is((select review_state from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=1),
  '{"type":"connect-pairs","paths":{"a":[0],"b":[5,6,7,8,9]}}'::jsonb,'Reopened CP result retains the snapshot from pending evaluation');
reset role;

-- An opted-in 5×5 board with three four-cell routes and two longer routes.
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
  type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('cp-partial-qv'), question_definition_id, 2, payload_schema_version,
  type, time_limit_ms, jsonb_set(public_payload, '{pairs}', (
    select jsonb_agg(jsonb_build_object('id', pair.id, 'label', upper(pair.id), 'symbol', upper(pair.id),
      'endpoints', jsonb_build_array(pair.start_cell, pair.end_cell)) order by pair.id)
    from (values ('a',0,3), ('b',4,7), ('c',6,11), ('d',12,18), ('e',17,24)) pair(id,start_cell,end_cell)
  )), created_by_player_id from private.question_versions where id = test_support.id('cp-qv-1');
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('cp-partial-qv'),
  '{"paths":{"a":[0,1,2,3],"b":[4,9,8,7],"c":[6,5,10,11],"d":[12,13,14,19,18],"e":[17,16,15,20,21,22,23,24]}}');
update private.question_versions set status = 'published' where id = test_support.id('cp-partial-qv');
insert into private.challenge_versions(id, challenge_definition_id, version_number, mode, title,
  global_time_limit_ms, mode_config, created_by_player_id)
values (test_support.id('cp-partial-cv'), test_support.id('ct-cd'), 5, 'time-trial', 'Conectar parejas parcial',
  1000, '{"connectPairsTimeoutPartialCredit":true}', test_support.id('owner'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points)
values
  (test_support.id('cp-partial-item-1'), test_support.id('cp-partial-cv'), test_support.id('cp-partial-qv'), 1, 15),
  (test_support.id('cp-partial-item-2'), test_support.id('cp-partial-cv'), test_support.id('cp-qv-1'), 2, 85);
update private.challenge_versions set status = 'published' where id = test_support.id('cp-partial-cv');
insert into public.rooms(id, slug, title)
select test_support.id('cp-room-'||n), 'cp-room-'||n, 'Conectar parejas parcial' from generate_series(8,10) n;
insert into public.room_memberships(room_id, player_id, role)
select test_support.id('cp-room-'||n), m.player_id, m.role from public.room_memberships m
cross join generate_series(8,10) n where m.room_id = test_support.id('room-pyramid');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
select test_support.id('cp-season-'||n), test_support.id('cp-room-'||n), 'CP parcial', 'active',
  now()-interval '1 day', now()+interval '1 day' from generate_series(8,10) n;
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select test_support.id('cp-sc-'||n), test_support.id('cp-season-'||n), test_support.id('cp-partial-cv'),
  1, 'open', now()-interval '1 hour', now()+interval '1 day' from generate_series(8,10) n;

select test_support.as_actor('owner');
set local role authenticated;
select is((select can_start from public.get_room_calendar('cp-room-8')),true,'Calendar admits opted-in Connect pairs');
select is(public.get_my_competitive_challenge('cp-room-8',test_support.id('cp-sc-8'))
  ->'rows'->0->'connect_pairs_timeout_partial_credit','true'::jsonb,'Competitive metadata carries the opt-in');
reset role;
set local role service_role;
select test_support.start_cp(8);
select test_support.run('save_connect_pairs_draft',
  '{"paths":{"a":[3,2,1,0],"b":[4,9,8,7],"c":[6,5,10,11],"d":[12,13,14,19]}}');
select pg_sleep(1.05);
select throws_ok($$select test_support.run('save_connect_pairs_draft','{"paths":{}}')$$,
  '55000','deadline_reached','An expired edit cannot replace the scoring checkpoint');
select is(test_support.run('complete_attempt')->'score','7'::jsonb,'3/5 pairs and 12/25 cells earn seven points');
select is((select last_result->'timeTrial'->'solvedCount' from test_support.runtime),'0'::jsonb,
  'Timeout points do not count as a solved board');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Completion replay retains the partial');
select is((select array_agg(amount) from private.flash_point_entries
  where attempt_id = (select (state->>'attemptId')::uuid from test_support.runtime)),
  array[7], 'Exactly one partial accreditation is recorded');
reset role;
set local role authenticated;
select ok((select result_details @> '{"timeoutPartialCredit":true,"connectedPairs":3,"coveredCells":12}'
  and review_state->'paths'->'d' = '[12,13,14,19]'::jsonb
  from public.get_my_time_trial_result((select (state->>'attemptId')::uuid from test_support.runtime))
  where item_position=1), 'Reloaded review retains the open path and only credits closed paths');
reset role;
set local role service_role;
select test_support.as_actor('member');
select test_support.start_cp(8);
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2,3],"b":[4,9,8,7],"c":[6,5,10,11]}}');
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2,3],"b":[4,9,8,7]}}');
select pg_sleep(1.05);
select is(test_support.run('complete_attempt')->'score','4'::jsonb,'Deleting a route reduces the partial');

select test_support.as_actor('member2');
select test_support.start_cp(8);
select test_support.run('receive_answer','{"answer":{"paths":{"a":[3,2,1,0],"b":[4,9,8,7],"c":[6,5,10,11],"d":[12,13,14,19,18],"e":[17,16,15,20,21,22,23,24]}}}');
select is(test_support.run('record_evaluation','{"status":"correct","points":15}')->'points','15'::jsonb,
  'A legal solution received on time earns its full weight');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer',jsonb_build_object('answer',test_support.cp_alternative()));
select pg_sleep(1.05);
select test_support.run('record_evaluation','{"status":"correct","points":85}');
select is(test_support.run('complete_attempt')->'score','100'::jsonb,'A timely alternative route earns full credit even when evaluated late');
reset role;
set local role authenticated;
select is((select array_agg(flash_points order by position) from public.get_challenge_ranking(test_support.id('cp-sc-8'))),
  array[100,7,4]::bigint[], 'Solved boards rank first, then partial points break ties at zero solved');
reset role;
update public.scheduled_challenges set status='closed' where id=test_support.id('cp-sc-8');
set local role authenticated;
select is((select array_agg(flash_points order by position) from public.get_room_history('cp-room-8',test_support.id('cp-sc-8'))),
  array[100,7,4]::bigint[], 'History agrees with the opted-in ranking');
reset role;
select test_support.as_actor('owner');
set local role service_role;
select test_support.start_cp(9);
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2,3],"b":[4,9,8,7],"c":[6,5,10,11],"d":[12,13,14,19,18],"e":[17,16,15,20,21,22,23,24]}}');
select pg_sleep(1.05);
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->'points','14'::jsonb,
  'A fully covered draft earns at most fourteen through expired recovery');
select is(test_support.run('complete_attempt')->'timeTrial'->>'endReason','time_limit',
  'Expired recovery keeps the timeout reason');

select test_support.start_cp(10);
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2,3]}}');
select test_support.run('recover_attempt');
select pg_sleep(1.05);
select is(test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->'receiptId' from test_support.runtime),'status','unanswered','points',0)))->'score',
  '0'::jsonb,'Early interruption gets zero even when reconciled after expiry');
reset role;

select * from finish();
rollback;
