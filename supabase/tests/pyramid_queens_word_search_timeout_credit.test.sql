begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
-- @pyramid-queens-fixtures

insert into private.question_definitions(id,slug,created_by_player_id)
values (test_support.id('partial-words-q'),'pyramid-partial-words',test_support.id('owner')),
  (test_support.id('partial-pairs-q'),'pyramid-partial-pairs',test_support.id('owner'));
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
values
  (test_support.id('partial-words-qv'),test_support.id('partial-words-q'),1,'word-search',1200,
    '{"question":"Encuentra las palabras.","grid":{"rows":6,"columns":6},"letters":["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","Ñ","Á","É","Í","Ó","Ú","Ü","D","E","F"],"targets":[{"id":"abc","word":"ABC"},{"id":"mno","word":"MNO"}]}',
    test_support.id('owner')),
  (test_support.id('partial-pairs-qv'),test_support.id('partial-pairs-q'),1,'connect-pairs',1200,
    '{"question":"Une las parejas.","grid":{"rows":4,"columns":4},"requireFullCoverage":true,"pairs":[{"id":"a","label":"A","symbol":"A","endpoints":[0,3]},{"id":"b","label":"B","symbol":"B","endpoints":[4,7]},{"id":"c","label":"C","symbol":"C","endpoints":[8,11]},{"id":"d","label":"D","symbol":"D","endpoints":[12,15]}]}',
    test_support.id('owner'));
insert into private.question_version_solutions(question_version_id,solution_payload)
values
  (test_support.id('partial-words-qv'),'{"positionsByTargetId":{"abc":{"startCell":0,"endCell":2},"mno":{"startCell":12,"endCell":14}}}'),
  (test_support.id('partial-pairs-qv'),'{"paths":{"a":[0,1,2,3],"b":[4,5,6,7],"c":[8,9,10,11],"d":[12,13,14,15]}}');
update private.question_versions set status='published'
where id in (test_support.id('partial-words-qv'),test_support.id('partial-pairs-qv'));

insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id,mode_config)
select test_support.id('partial-credit-version-'||n),test_support.id('cd-pyramid'),n,
  'pyramid','Pirámide con parciales',test_support.id('owner'),config
from (values
  (2,'{"wordSearchTimeoutPartialCredit":true}'::jsonb),
  (3,'{"queensTimeoutPartialCredit":true}'::jsonb),
  (4,'{"wordSearchTimeoutPartialCredit":true,"queensTimeoutPartialCredit":true,"connectPairsTimeoutPartialCredit":true}'::jsonb),
  (5,'{}'::jsonb)
) versions(n,config);
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,mode_config)
select test_support.id('partial-credit-item-'||n||'-'||position),
  test_support.id('partial-credit-version-'||n),
  case position when 1 then test_support.id('partial-words-qv')
    when 2 then test_support.id('pyramid-queens-timeout-qv')
    when 3 then test_support.id('partial-pairs-qv') else question_version_id end,
  position, case when position <= 2 then 15 else 14 end, mode_config
from private.challenge_items cross join generate_series(2,5) n
where challenge_version_id=test_support.id('cv-pyramid');
update private.challenge_versions set status='published'
where challenge_definition_id=test_support.id('cd-pyramid') and status='draft';

insert into public.rooms(id,slug,title)
select test_support.id('partial-room-'||n),'pyramid-partials-'||n,'Pirámide con parciales' from generate_series(2,5) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('partial-room-'||n),player_id,role from public.room_memberships cross join generate_series(2,5) n
where room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('partial-season-'||n),test_support.id('partial-room-'||n),
  'Parciales','active',now()-interval '2 days',now()+interval '2 days' from generate_series(2,5) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('partial-sc-'||n),test_support.id('partial-season-'||n),
  test_support.id('partial-credit-version-'||n),1,'open',now()-interval '1 day',now()+interval '1 day'
from generate_series(2,5) n;

create function test_support.start_partial_pyramid(version integer, queen_level boolean default false) returns void
language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object(
    'scheduledChallengeId',test_support.id('partial-sc-'||version),
    'sessionToken',gen_random_uuid()::text || gen_random_uuid()::text));
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
  if queen_level then
    perform test_support.run('submit_word_search_selection','{"startCell":0,"endCell":2}');
    perform test_support.run('submit_word_search_selection','{"startCell":12,"endCell":14}');
    perform test_support.run('record_evaluation','{"status":"correct","points":15}');
    perform test_support.run('prepare_interaction');
    perform test_support.run('activate_interaction');
  end if;
end;
$$;
create function test_support.wait_for_level_deadline() returns void language sql as $$
  select pg_sleep_until((state->>'deadlineAt')::timestamptz) from test_support.runtime
$$;
grant execute on function test_support.start_partial_pyramid(integer, boolean), test_support.wait_for_level_deadline() to service_role;
grant select on test_support.runtime to authenticated;

select ok(not private.is_valid_pyramid_config('{"queensTimeoutPartialCredit":true}',array['word-search']),
  'A flag requires a level of its own format');
select ok(not private.is_valid_pyramid_config('{"queensTimeoutPartialCredit":false}',array['queens']),
  'Flags accept only true');
select ok(not private.is_valid_pyramid_config('{"unexpected":true}',array['queens']),
  'Unknown configuration is rejected');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('partial-credit-version-4'))$$,
  'All three flags can coexist in an eligible publication');
select test_support.as_actor('member');
set local role authenticated;
select ok(public.get_my_competitive_challenge('pyramid-partials-4',test_support.id('partial-sc-4'))->'rows'->0
  @> '{"connect_pairs_timeout_partial_credit":true,"word_search_timeout_partial_credit":true,"queens_timeout_partial_credit":true}',
  'Playable projection exposes all active flags independently');
reset role;

set local role service_role;
select test_support.start_partial_pyramid(2);
select test_support.run('submit_word_search_selection','{"startCell":0,"endCell":3}');
select test_support.run('submit_word_search_selection','{"startCell":2,"endCell":0}');
select throws_ok($$select test_support.run('submit_word_search_selection','{"startCell":0,"endCell":2}')$$,
  '55000','word_search_target_already_found','A repeated word earns nothing extra');
select test_support.wait_for_level_deadline();
select throws_ok($$select test_support.run('submit_word_search_selection','{"startCell":12,"endCell":14}')$$,
  '55000','deadline_reached','A word at or after the deadline is rejected');
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"partial","points":15}')->>'points','7',
  'Word Search uses the accepted event fraction and ignores evaluator points');
select is((select last_result->'details'->>'incorrectSelections' from test_support.runtime),'1',
  'One incorrect selection stays in review and incurs no deduction');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Evaluation replay is identical');
select throws_ok($$select test_support.run('prepare_interaction')$$,
  '55000','pyramid_level_failed','A partial Word Search cannot unlock the next level');
select is(test_support.run('complete_attempt')->>'score','7','Word Search partial is accredited');
select is(test_support.repeat_last()->>'score','7','Completion replay does not duplicate credit');
reset role;
set local role authenticated;
select is((select review_state->'foundWordIds' from public.get_my_pyramid_result(
  (select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=1),
  '["abc"]'::jsonb,'Reloaded review identifies the words that counted');
select is((select flash_points from public.get_challenge_ranking(test_support.id('partial-sc-2'))),7::bigint,
  'Word Search partial reaches the ranking');
reset role;

set local role service_role;
select test_support.start_partial_pyramid(3,true);
select test_support.run('save_queens_draft','{"queens":[2,9,10,18]}');
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,20]}');
select test_support.wait_for_level_deadline();
select throws_ok($$select test_support.run('save_queens_draft','{"queens":[2,9,10,18,21]}')$$,
  '55000','deadline_reached','A late save cannot replace the last Queens checkpoint');
select test_support.run('receive_answer','{"answer":null}');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'points','11',
  'Three of four own Queens earn eleven points after a failed validation');
select is((select last_result->'reviewState'->'queens' from test_support.runtime),
  '[2,9,10,18,20]'::jsonb,'The accepted validation updates the board used for scoring');
select is((select last_result->'details'->>'correctPlacements' from test_support.runtime),'3',
  'The fixed queen is excluded from the count');
select throws_ok($$select test_support.run('prepare_interaction')$$,
  '55000','pyramid_level_failed','A Queens partial cannot unlock the next level');
select is(test_support.run('complete_attempt')->>'score','26','Queens partial adds to prior points');
reset role;
set local role authenticated;
select is((select review_state->'queens' from public.get_my_pyramid_result(
  (select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=2),
  '[2,9,10,18,20]'::jsonb,'Reloaded Queens review uses the scored board');
select is((select flash_points from public.get_season_ranking(test_support.id('partial-season-3'))
  where player_id=test_support.id('member')),26::bigint,'Queens partial reaches the season ranking');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.start_partial_pyramid(3,true);
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,20]}');
select pg_sleep(0.35);
select test_support.run('save_queens_draft','{"queens":[2,9,10,18,21]}');
select test_support.wait_for_level_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'status',
  'correct','A complete Queens checkpoint is recognized at expiry');
select ok((select (last_result->>'points')::integer > 8 and (last_result->>'points')::integer < 14
  from test_support.runtime),'Queens uses the saved time and the previous validation penalty');
select is(test_support.run('prepare_interaction')->>'challengeItemId',test_support.id('partial-credit-item-3-3')::text,
  'A solved checkpoint opens the next level');
reset role;

select test_support.as_actor('owner');
set local role service_role;
select test_support.start_partial_pyramid(3,true);
select test_support.run('save_queens_draft','{"queens":[2]}');
select test_support.wait_for_level_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'points','0',
  'Only fixed Queens earn zero');
select test_support.start_partial_pyramid(4,true);
select test_support.run('save_queens_draft','{"queens":[2,9,10,18,21]}');
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"correct","points":15}')->>'points','0',
  'An interruption before expiry does not score even a solved Queens draft');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.start_partial_pyramid(4,true);
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,20]}');
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,20]}');
select is(test_support.run('submit_queens_answer','{"queens":[2,9,10,18,20]}')->>'terminal','true',
  'The third failed validation still creates a final receipt');
select is(test_support.run('record_evaluation','{"status":"incorrect","points":11}')->>'points','0',
  'A failed final validation cannot earn partial credit');
select test_support.start_partial_pyramid(5);
select test_support.run('submit_word_search_selection','{"startCell":0,"endCell":2}');
select test_support.wait_for_level_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"partial","points":7}')->>'points','0',
  'A version without the flag retains zero points');
reset role;

select test_support.as_actor('member');
set local role service_role;
select test_support.start_partial_pyramid(4,true);
select test_support.run('submit_queens_answer','{"queens":[2,9,10,18,21]}');
select test_support.run('record_evaluation','{"status":"correct","points":15}');
select test_support.run('prepare_interaction');
select test_support.run('activate_interaction');
select test_support.run('save_connect_pairs_draft','{"paths":{"a":[0,1,2,3],"b":[4,5,6,7]}}');
select test_support.wait_for_level_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'points','7',
  'Connect Pairs still earns its normal partial alongside both new flags');
reset role;

select * from finish();
rollback;
