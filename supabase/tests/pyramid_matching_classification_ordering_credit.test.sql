begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

insert into private.question_definitions(id,slug,created_by_player_id)
select test_support.id('draft-credit-'||format),'pyramid-draft-credit-'||format,test_support.id('owner')
from unnest(array['matching','classification','ordering']) format;
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
select test_support.id('draft-credit-qv-'||format),test_support.id('draft-credit-'||format),1,format,1400,payload,test_support.id('owner')
from (values
  ('matching','{"question":"Empareja.","leftItems":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"},{"id":"d","label":"D"},{"id":"e","label":"E"}],"rightItems":[{"id":"1","label":"Uno"},{"id":"2","label":"Dos"},{"id":"3","label":"Tres"},{"id":"4","label":"Cuatro"},{"id":"5","label":"Cinco"}]}'::jsonb),
  ('classification','{"question":"Clasifica.","items":[{"label":"A"},{"label":"B"},{"label":"C"},{"label":"D"},{"label":"E"},{"label":"F"}],"categories":["Uno","Dos"]}'::jsonb),
  ('ordering','{"question":"Ordena.","items":["A","B","C","E","D"]}'::jsonb)
) questions(format,payload);
insert into private.question_version_solutions(question_version_id,solution_payload)
select test_support.id('draft-credit-qv-'||format),solution from (values
  ('matching','{"matches":{"a":"1","b":"2","c":"3","d":"4","e":"5"}}'::jsonb),
  ('classification','{"categoriesByItem":{"A":"Uno","B":"Uno","C":"Uno","D":"Dos","E":"Dos","F":"Dos"}}'::jsonb),
  ('ordering','{"correctOrder":["A","B","C","D","E"]}'::jsonb)
) solutions(format,solution);
update private.question_versions set status='published' where question_definition_id in
  (select id from private.question_definitions where slug like 'pyramid-draft-credit-%');

insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id,mode_config)
select test_support.id('draft-credit-version-'||n),test_support.id('cd-pyramid'),n,
  'pyramid','Pirámide de borradores',test_support.id('owner'),config
from (values
  (2,'{"matchingPartialCredit":true}'::jsonb),
  (3,'{"classificationPartialCredit":true}'::jsonb),
  (4,'{"orderingPartialCredit":true}'::jsonb),
  (5,'{"matchingPartialCredit":true,"classificationPartialCredit":true,"orderingPartialCredit":true}'::jsonb),
  (6,'{}'::jsonb)
) versions(n,config);
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,mode_config)
select test_support.id('draft-credit-item-'||n||'-'||position),test_support.id('draft-credit-version-'||n),
  case
    when position = 1 then test_support.id('draft-credit-qv-'||
      case n when 2 then 'matching' when 3 then 'classification' else 'ordering' end)
    when position = 2 and n <> 2 then test_support.id('draft-credit-qv-matching')
    when position = 3 and n <> 3 then test_support.id('draft-credit-qv-classification')
    else question_version_id end,
  position, case when position = 1 then 15 when position = 2 then 13 else points end,mode_config
from private.challenge_items cross join generate_series(2,6) n
where challenge_version_id=test_support.id('cv-pyramid');
update private.challenge_versions set status='published'
where challenge_definition_id=test_support.id('cd-pyramid') and status='draft';

insert into public.rooms(id,slug,title)
select test_support.id('draft-credit-room-'||n),'pyramid-draft-credit-'||n,'Pirámide de borradores'
from generate_series(2,6) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('draft-credit-room-'||n),player_id,role
from public.room_memberships cross join generate_series(2,6) n where room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('draft-credit-season-'||n),test_support.id('draft-credit-room-'||n),
  'Borradores','active',now()-interval '2 days',now()+interval '2 days' from generate_series(2,6) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('draft-credit-sc-'||n),test_support.id('draft-credit-season-'||n),
  test_support.id('draft-credit-version-'||n),1,'open',now()-interval '1 day',now()+interval '1 day'
from generate_series(2,6) n;

create function test_support.open_draft_credit_level(version integer) returns void language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object(
    'scheduledChallengeId',test_support.id('draft-credit-sc-'||version),
    'sessionToken',gen_random_uuid()::text || gen_random_uuid()::text));
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
end;
$$;
create function test_support.wait_for_draft_credit_deadline() returns void language sql as $$
  select pg_sleep_until((state->>'deadlineAt')::timestamptz) from test_support.runtime
$$;
grant execute on function test_support.open_draft_credit_level(integer), test_support.wait_for_draft_credit_deadline() to service_role;
grant select on test_support.runtime to authenticated;

select ok(not private.is_valid_pyramid_config('{"matchingPartialCredit":true}',array['connect-pairs']),
  'Matching and Connect Pairs are independent formats');
select ok(not private.is_valid_pyramid_config('{"classificationPartialCredit":true}',array['ordering']),
  'Classification requires a Classification level');
select ok(not private.is_valid_pyramid_config('{"orderingPartialCredit":false}',array['ordering']),
  'A flag accepts true or omission');
select ok(private.is_valid_pyramid_config(
  '{"matchingPartialCredit":true,"classificationPartialCredit":true,"orderingPartialCredit":true,"connectPairsTimeoutPartialCredit":true,"wordSearchTimeoutPartialCredit":true,"queensTimeoutPartialCredit":true}',
  array['matching','classification','ordering','connect-pairs','word-search','queens']),
  'All six flags can coexist');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('draft-credit-version-5'))$$,
  'Calendar accepts a version with all three formats');

select test_support.as_actor('member');
set local role authenticated;
select ok(public.get_my_competitive_challenge('pyramid-draft-credit-5',test_support.id('draft-credit-sc-5'))->'rows'->0
  @> '{"matching_partial_credit":true,"classification_partial_credit":true,"ordering_partial_credit":true}',
  'The playable projection exposes the new flags');
reset role;

set local role service_role;
select test_support.open_draft_credit_level(2);
select throws_ok($$select test_support.run('save_pyramid_draft','{"answer":{"a":"1","b":"1"}}')$$,
  '22023','invalid_command','Matching rejects duplicate right items');
select throws_ok($$select test_support.run('receive_answer','{"answer":{"a":"1"}}')$$,
  '22023','invalid_command','An incomplete final Matching answer is rejected');
select test_support.run('save_pyramid_draft','{"answer":{"a":"1","b":"2","c":"3","d":"4","e":"5"}}');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'A lost draft confirmation is replayed');
select lives_ok($$select test_support.run('receive_answer',jsonb_build_object(
  'answer','{"a":"1","b":"2","c":"3","d":"5","e":"4"}'::jsonb,
  'lockVersion',(select (state->>'lockVersion')::bigint - 1 from test_support.runtime)))$$,
  'A timely final answer can overtake the accepted draft with its original revision');
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"correct","points":15}')->>'points','9',
  'A timely incorrect submission takes precedence over a solved draft and earns its partial');
select is((select last_result->'details'->>'pyramidPartialCredit' from test_support.runtime),'submission',
  'The credited source is the submission');
select throws_ok($$select test_support.run('prepare_interaction')$$,
  '55000','pyramid_level_failed','An explicitly confirmed partial cannot advance');
select is(test_support.run('complete_attempt')->>'score','9','Matching points are accredited');
select is(test_support.repeat_last()->>'score','9','A lost completion response does not accrue extra points');
reset role;
set local role authenticated;
select is((select flash_points from public.get_challenge_ranking(test_support.id('draft-credit-sc-2'))),9::bigint,
  'Matching is in the challenge ranking');
reset role;

set local role service_role;
select test_support.open_draft_credit_level(3);
select throws_ok($$select test_support.run('save_pyramid_draft','{"answer":{"A":"Tres"}}')$$,
  '22023','invalid_command','Classification rejects a category outside the question');
select test_support.run('save_pyramid_draft','{"answer":{"A":"Uno","B":"Uno","C":"Uno","D":"Uno"}}');
select test_support.wait_for_draft_credit_deadline();
select throws_ok($$select test_support.run('save_pyramid_draft','{"answer":{"A":"Dos"}}')$$,
  '55000','deadline_reached','A save at or after expiry is rejected');
select test_support.run('receive_answer','{"answer":{"A":"Uno","B":"Uno","C":"Uno","D":"Dos","E":"Dos","F":"Dos"}}');
select is(test_support.run('record_evaluation','{"status":"correct","points":15}')->>'points','7',
  'Classification uses the saved three of six and ignores the late full submission');
select is((select last_result->'details'->>'pyramidPartialCredit' from test_support.runtime),'timeout',
  'The credited source is the saved draft');
select is(test_support.run('complete_attempt')->>'score','7','Classification points are accredited');
reset role;
set local role authenticated;
select is((select review_state->'answer' from public.get_my_pyramid_result(
  (select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=1),
  '{"A":"Uno","B":"Uno","C":"Uno","D":"Uno"}'::jsonb,'Classification review retains the scored draft');
select is((select flash_points from public.get_season_ranking(test_support.id('draft-credit-season-3'))
  where player_id=test_support.id('member')),7::bigint,'Classification reaches the season ranking');
reset role;

set local role service_role;
select test_support.open_draft_credit_level(4);
select throws_ok($$select test_support.run('save_pyramid_draft','{"answer":["A","B","C","D","D"]}')$$,
  '22023','invalid_command','Ordering rejects a repeated item');
select throws_ok($$select test_support.run('receive_answer','{"answer":["A","B","C","D","F"]}')$$,
  '22023','invalid_command','Ordering rejects an unknown item in a final submission');
select test_support.run('save_pyramid_draft','{"answer":["B","A","C","D","E"]}');
select test_support.wait_for_draft_credit_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'points','9',
  'Recovery scores the three exact positions in the accepted Ordering draft');
select is((select last_result->'reviewState'->'answer' from test_support.runtime),'["B","A","C","D","E"]'::jsonb,
  'Ordering review shows the saved order');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.open_draft_credit_level(4);
select test_support.wait_for_draft_credit_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"partial","points":9}')->>'points','0',
  'An untouched initial order scores zero at expiry');
select test_support.open_draft_credit_level(5);
select pg_sleep(0.25);
select test_support.run('save_pyramid_draft','{"answer":["A","B","C","D","E"]}');
select test_support.wait_for_draft_credit_deadline();
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'status','correct',
  'A complete saved order is correct');
select ok((select (last_result->>'points')::integer > 9 from test_support.runtime),
  'The correct saved order is scored at its save time');
select is(test_support.run('prepare_interaction')->>'challengeItemId',test_support.id('draft-credit-item-5-2')::text,
  'A complete saved order opens the next level');
reset role;

select test_support.as_actor('owner');
set local role service_role;
select test_support.open_draft_credit_level(5);
select test_support.run('save_pyramid_draft','{"answer":["A","B","C","D","E"]}');
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"correct","points":15}')->>'points','0',
  'Recovery before expiry does not score even a solved draft');
select test_support.open_draft_credit_level(6);
select throws_ok($$select test_support.run('save_pyramid_draft','{"answer":["A","B","C","D","E"]}')$$,
  '22023','invalid_command','Disabled versions reject the new draft operation');
select test_support.run('receive_answer','{"answer":["A","B","C","E","D"]}');
select is(test_support.run('record_evaluation','{"status":"partial","points":9}')->>'points','0',
  'A disabled version retains zero for a submitted partial');
reset role;

select * from finish();
rollback;
