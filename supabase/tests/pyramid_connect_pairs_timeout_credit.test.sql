begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create function test_support.pyramid_paths() returns jsonb language sql immutable as $$
  select '{"circle":[0,1,2,3,4,9],"triangle":[8,7,6,5,10],
    "diamond":[11,12,13,14,19,18],"star":[17,16,15,20,21,22,23,24]}'::jsonb
$$;

insert into private.question_definitions(id,slug,created_by_player_id)
values (test_support.id('pyramid-cp-q'),'commands-pyramid-cp',test_support.id('superadmin'));
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
values (test_support.id('pyramid-cp-qv'),test_support.id('pyramid-cp-q'),1,'connect-pairs',1000,
  '{"question":"Cubre la cuadrícula.","grid":{"rows":5,"columns":5},"pairs":[
    {"id":"circle","label":"Círculo","symbol":"●","endpoints":[0,9]},
    {"id":"triangle","label":"Triángulo","symbol":"▲","endpoints":[8,10]},
    {"id":"diamond","label":"Rombo","symbol":"◆","endpoints":[11,18]},
    {"id":"star","label":"Estrella","symbol":"★","endpoints":[17,24]}],"requireFullCoverage":true}',
  test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id,solution_payload)
values (test_support.id('pyramid-cp-qv'),jsonb_build_object('paths',test_support.pyramid_paths()));
update private.question_versions set status='published' where id=test_support.id('pyramid-cp-qv');

insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id,mode_config)
select test_support.id('pyramid-cp-v'||n),test_support.id('cd-pyramid'),n,'pyramid','Cumbre lógica',
  test_support.id('superadmin'),case when n=2 then '{"connectPairsTimeoutPartialCredit":true}'::jsonb else '{}'::jsonb end
from generate_series(2,3) n;
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,mode_config)
select test_support.id('pyramid-cp-item-'||n||'-'||i.position),test_support.id('pyramid-cp-v'||n),
  case when i.position=5 then test_support.id('pyramid-cp-qv') else i.question_version_id end,
  i.position,case when i.position=1 then 13 when i.position=5 then 15 else i.points end,
  i.mode_config
from private.challenge_items i cross join generate_series(2,3) n
where i.challenge_version_id=test_support.id('cv-pyramid');
update private.challenge_versions set status='published'
where id in (test_support.id('pyramid-cp-v2'),test_support.id('pyramid-cp-v3'));

insert into public.rooms(id,slug,title)
select test_support.id('cp-pyramid-room-'||n),'cp-pyramid-'||n,'Cumbre lógica' from generate_series(2,3) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('cp-pyramid-room-'||n),test_support.id(actor),
  case when actor='owner' then 'owner' else 'member' end
from generate_series(2,3) n cross join unnest(array['owner','member','member2']) actor;
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('cp-pyramid-season-'||n),test_support.id('cp-pyramid-room-'||n),
  'Tabarnia','active',now()-interval '2 days',now()+interval '2 days' from generate_series(2,3) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('cp-pyramid-sc-'||n),test_support.id('cp-pyramid-season-'||n),
  test_support.id('pyramid-cp-v'||n),1,'open',now()-interval '1 day',now()+interval '1 day'
from generate_series(2,3) n;

create function test_support.start_pyramid_cp(version integer) returns void language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object(
    'scheduledChallengeId',test_support.id('cp-pyramid-sc-'||version),'sessionToken',gen_random_uuid()::text || gen_random_uuid()::text));
  for position in 1..4 loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('activate_interaction');
    perform test_support.run('receive_answer','{"answer":"A"}');
    perform test_support.run('record_evaluation',jsonb_build_object(
      'status','correct','points',case when position=1 then 13 else 14 end));
  end loop;
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
end;
$$;

grant execute on function test_support.start_pyramid_cp(integer), test_support.pyramid_paths() to service_role;
grant select on test_support.runtime to authenticated;

-- Wait for the actual immutable deadline of this short test level.
create function test_support.expire_pyramid_cp() returns void language sql as $$
  select pg_sleep_until((state->>'deadlineAt')::timestamptz) from test_support.runtime
$$;

select lives_ok($$select private.assert_supported_calendar_content(test_support.id('pyramid-cp-v2'))$$,
  'An opted-in Pyramid is eligible for the calendar');
select test_support.as_actor('member');
set local role authenticated;
select is(public.get_my_competitive_challenge('cp-pyramid-2',test_support.id('cp-pyramid-sc-2'))
  ->'rows'->4->'connect_pairs_timeout_partial_credit','true'::jsonb,'Playable projection exposes the version rule');
reset role;
set local role service_role;
select test_support.start_pyramid_cp(2);
select test_support.run('save_connect_pairs_draft',
  '{"paths":{"circle":[0,1,2,3,4,9],"diamond":[11,12,13,14,19,18],"star":[17,16]}}');
reset role;
select test_support.expire_pyramid_cp();
set local role service_role;
select is(test_support.repeat_last(),(select last_result from test_support.runtime),
  'An accepted save can replay after the deadline');
select throws_ok($$select test_support.run('save_connect_pairs_draft',jsonb_build_object('paths',test_support.pyramid_paths()))$$,
  '55000','deadline_reached','A new draft cannot overwrite the checkpoint at expiry');
select test_support.run('receive_answer',jsonb_build_object('answer',jsonb_build_object('paths',test_support.pyramid_paths())));
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'status','partial',
  'A late answer is ignored and the incomplete checkpoint is evaluated');
select is((select (last_result->>'points')::integer from test_support.runtime),7,'Two pairs and twelve cells earn seven points');
select is((select (last_result->'details'->>'coveredCells')::integer from test_support.runtime),12,
  'Open routes are excluded from credit');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),
  'Evaluation replay returns the same score and details');
select throws_ok($$select test_support.run('prepare_interaction')$$,'55000','pyramid_level_failed',
  'Partial credit does not unlock the next level');
select is(test_support.run('complete_attempt')->>'outcome','failed','The credited ascent ends as failed');
select is(test_support.repeat_last()->>'score','62','The completed attempt credits the sum once');
reset role;
select is((select count(*) from private.flash_point_entries
  where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),1::bigint,'Only one ledger entry');
set local role authenticated;
select is((select flash_points from public.get_challenge_ranking(test_support.id('cp-pyramid-sc-2'))),62::bigint,
  'The challenge ranking includes the partial points');
select is((select flash_points from public.get_season_ranking(test_support.id('cp-pyramid-season-2'))
  where player_id=test_support.id('member')),62::bigint,'The season ranking includes the partial points');
select is((select review_state->'paths'->'star' from public.get_my_pyramid_result(
  (select (state->>'attemptId')::uuid from test_support.runtime)) where item_position=5),'[17,16]'::jsonb,
  'Reloaded review keeps the open route from the accepted checkpoint');
select is((select count(*) from public.get_my_pyramid_result(
  (select (state->>'attemptId')::uuid from test_support.runtime))),5::bigint,'The next level remains unreached');
reset role;

select test_support.as_actor('member2');
set local role service_role;
select test_support.start_pyramid_cp(2);
select pg_sleep(0.45);
select test_support.run('save_connect_pairs_draft',jsonb_build_object('paths',test_support.pyramid_paths()));
reset role;
select test_support.expire_pyramid_cp();
set local role service_role;
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'status',
  'correct','Recovery recognizes a complete accepted checkpoint');
select is((select (last_result->>'points')::integer from test_support.runtime),12,
  'A complete checkpoint saved halfway through earns normal speed points');
select is(test_support.run('prepare_interaction')->>'challengeItemId',test_support.id('pyramid-cp-item-2-6')::text,
  'An accepted complete checkpoint opens the next level');
reset role;

select test_support.as_actor('member');
set local role service_role;
select test_support.start_pyramid_cp(3);
select test_support.run('save_connect_pairs_draft','{"paths":{"circle":[0,1,2,3,4,9],"diamond":[11,12,13,14,19,18]}}');
reset role;
select test_support.expire_pyramid_cp();
set local role service_role;
select test_support.run('recover_attempt');
select is(test_support.run('record_evaluation','{"status":"unanswered","points":0}')->>'points',
  '0','The same board earns zero with the option disabled');
reset role;

select * from finish();
rollback;
