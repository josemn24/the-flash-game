begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

-- Regression: a Classification draft (classificationPartialCredit) stayed in
-- attempts.progress_payload after the level was answered, so the next
-- Word-hashtag swap failed with invalid_progress (HTTP 503) and blocked the run.

insert into private.question_definitions(id,slug,created_by_player_id) values
  (test_support.id('stale-classification'),'pyramid-stale-classification',test_support.id('owner')),
  (test_support.id('stale-hashtag'),'pyramid-stale-hashtag',test_support.id('owner'));
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id) values
  (test_support.id('stale-qv-classification'),test_support.id('stale-classification'),1,'classification',60000,
    '{"question":"Clasifica.","items":[{"label":"A"},{"label":"B"},{"label":"C"},{"label":"D"},{"label":"E"},{"label":"F"}],"categories":["Uno","Dos"]}'::jsonb,
    test_support.id('owner')),
  (test_support.id('stale-qv-hashtag'),test_support.id('stale-hashtag'),1,'word-hashtag',60000,
    jsonb_build_object(
      'question','Intercambia las letras.',
      'grid',jsonb_build_object('rows',5,'columns',5),
      'initialLetters',jsonb_build_array(
        null,'G',null,'Q',null,
        'E','O','P','U','I',
        null,'N',null,'Y',null,
        'R','A','U','M','E',
        null,'R',null,'A',null),
      'maxMoves',7),
    test_support.id('owner'));
insert into private.question_version_solutions(question_version_id,solution_payload) values
  (test_support.id('stale-qv-classification'),
    '{"categoriesByItem":{"A":"Uno","B":"Uno","C":"Uno","D":"Dos","E":"Dos","F":"Dos"}}'::jsonb),
  (test_support.id('stale-qv-hashtag'),
    '{"words":{"top":"YOGUI","bottom":"REUMA","left":"PONER","right":"QUEMA"}}'::jsonb);
update private.question_versions set status='published'
where question_definition_id in (test_support.id('stale-classification'),test_support.id('stale-hashtag'));

insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id,mode_config)
values (test_support.id('stale-version'),test_support.id('cd-pyramid'),2,'pyramid','Pirámide sin arrastre',
  test_support.id('owner'),'{"classificationPartialCredit":true}'::jsonb);
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points,mode_config)
select test_support.id('stale-item-'||position),test_support.id('stale-version'),
  case position
    when 1 then test_support.id('stale-qv-classification')
    when 2 then test_support.id('stale-qv-hashtag')
    else question_version_id end,
  position, case when position = 1 then 15 when position = 2 then 13 else points end, mode_config
from private.challenge_items where challenge_version_id=test_support.id('cv-pyramid');
update private.challenge_versions set status='published' where id=test_support.id('stale-version');

insert into public.rooms(id,slug,title) values (test_support.id('stale-room'),'pyramid-stale-progress','Pirámide sin arrastre');
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('stale-room'),player_id,role from public.room_memberships where room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values (test_support.id('stale-season'),test_support.id('stale-room'),'Sin arrastre','active',now()-interval '2 days',now()+interval '2 days');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values (test_support.id('stale-sc'),test_support.id('stale-season'),test_support.id('stale-version'),1,'open',
  now()-interval '1 day',now()+interval '1 day');

create function test_support.reach_stale_hashtag_level() returns void language plpgsql as $$
begin
  perform test_support.run('start_attempt',jsonb_build_object(
    'scheduledChallengeId',test_support.id('stale-sc'),
    'sessionToken',gen_random_uuid()::text || gen_random_uuid()::text));
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
  perform test_support.run('save_pyramid_draft','{"answer":{"A":"Uno","B":"Uno","C":"Uno","D":"Dos","E":"Dos","F":"Dos"}}');
  perform test_support.run('receive_answer','{"answer":{"A":"Uno","B":"Uno","C":"Uno","D":"Dos","E":"Dos","F":"Dos"}}');
  perform test_support.run('record_evaluation','{"status":"correct","points":15}');
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
end;
$$;
create function test_support.stale_attempt_progress() returns jsonb language sql security definer set search_path = '' as $$
  select a.progress_payload from public.attempts a
  where a.id = (select (state->>'attemptId')::uuid from test_support.runtime)
$$;
grant execute on function test_support.reach_stale_hashtag_level(), test_support.stale_attempt_progress() to service_role;

select test_support.as_actor('member');
set local role service_role;
select test_support.reach_stale_hashtag_level();
select is((select state->>'challengeItemId' from test_support.runtime),test_support.id('stale-item-2')::text,
  'The solved Classification level opens the Word-hashtag level');
select ok(test_support.stale_attempt_progress() is null,
  'Activating the next level discards the previous level''s Classification draft');
select lives_ok($$select test_support.run('submit_word_hashtag_swap',jsonb_build_object(
  'challengeItemId',test_support.id('stale-item-2'),'fromCell',1,'toCell',7))$$,
  'The first Word-hashtag swap after a Classification draft succeeds');
select is((select last_result->>'movesUsed' from test_support.runtime),'1',
  'The swap counts as the first move');
select is((select last_result->'correctCells' from test_support.runtime),
  jsonb_build_array(1,3,6,7,8,9,11,15,17,18,21,23),
  'The swap is applied to the initial board');
reset role;

-- Attempts that were already on the Word-hashtag level before this fix still hold the draft.
select test_support.as_actor('member2');
set local role service_role;
select test_support.reach_stale_hashtag_level();
reset role;
update public.attempts set lock_version = lock_version + 1, progress_payload = jsonb_build_object(
  'kind','pyramid-draft','challengeItemId',test_support.id('stale-item-1'),
  'answer','{"A":"Uno"}'::jsonb,'savedAt',now(),'baseRevision',1)
where id = (select (state->>'attemptId')::uuid from test_support.runtime);
update test_support.runtime set state = jsonb_set(state,'{lockVersion}',
  to_jsonb((select a.lock_version from public.attempts a where a.id = (state->>'attemptId')::uuid)));
set local role service_role;
select lives_ok($$select test_support.run('submit_word_hashtag_swap',jsonb_build_object(
  'challengeItemId',test_support.id('stale-item-2'),'fromCell',1,'toCell',7))$$,
  'A stale draft from a previous level no longer blocks the swap');
select is((select last_result->>'movesUsed' from test_support.runtime),'1',
  'The stale draft is not counted as Word-hashtag moves');
select is(test_support.stale_attempt_progress()->>'kind','word-hashtag',
  'The swap replaces the stale draft with Word-hashtag progress');
reset role;

select * from finish();
rollback;
