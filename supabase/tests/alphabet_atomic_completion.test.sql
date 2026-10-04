begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create function test_support.alphabet_publication(label text, item_count integer) returns uuid
language plpgsql as $$
declare version_id uuid := test_support.id(label || '-version'); publication_id uuid := test_support.id(label || '-publication');
begin
  insert into public.rooms(id, slug, title) values(test_support.id(label || '-room'), label, label);
  insert into public.room_memberships(room_id, player_id, role)
    values(test_support.id(label || '-room'), test_support.id('owner'), 'owner');
  insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
    values(test_support.id(label || '-season'), test_support.id(label || '-room'), label, 'active',
      now() - interval '1 day', now() + interval '1 day');
  insert into private.question_definitions(id, slug, created_by_player_id)
    select test_support.id(label || '-question-' || n), label || '-question-' || n, test_support.id('superadmin')
    from generate_series(1, item_count) n;
  insert into private.question_versions(id, question_definition_id, version_number, type,
    time_limit_ms, public_payload, created_by_player_id)
    select test_support.id(label || '-question-version-' || n), test_support.id(label || '-question-' || n),
      1, 'short-text', 10000, '{"question":"Letter"}', test_support.id('superadmin') from generate_series(1, item_count) n;
  insert into private.question_version_solutions(question_version_id, solution_payload)
    select test_support.id(label || '-question-version-' || n), '{"correctAnswer":"answer","acceptedAnswers":["answer"]}'
    from generate_series(1, item_count) n;
  update private.question_versions set status = 'published' where id in (
    select test_support.id(label || '-question-version-' || n) from generate_series(1, item_count) n);
  insert into private.challenge_definitions(id, slug, created_by_player_id)
    values(test_support.id(label || '-definition'), label, test_support.id('superadmin'));
  insert into private.challenge_versions(id, challenge_definition_id, version_number, mode, title,
    global_time_limit_ms, created_by_player_id)
    values(version_id, test_support.id(label || '-definition'), 1, 'alphabet', label, 100, test_support.id('superadmin'));
  insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, mode_config)
    select test_support.id(label || '-item-' || n), version_id, test_support.id(label || '-question-version-' || n), n,
      100 / item_count + case when n = item_count then 100 % item_count else 0 end,
      jsonb_build_object('letter', chr(64 + n)) from generate_series(1, item_count) n;
  update private.challenge_versions set status = 'published' where id = version_id;
  insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
    values(publication_id, test_support.id(label || '-season'), version_id, 1,
      'open', now() - interval '1 hour', now() + interval '1 hour');
  return publication_id;
end;
$$;

create function test_support.test_alphabet_completion(pending_count integer) returns setof text
language plpgsql as $$
declare
  item_count integer := case when pending_count = 0 then 2 when pending_count = 1 then 2 when pending_count = 5 then 6 else pending_count end;
  label text := 'bulk-alphabet-' || pending_count; publication_id uuid;
  target_attempt uuid; response jsonb; replay jsonb; current_item uuid;
begin
  publication_id := test_support.alphabet_publication(label, item_count);
  perform test_support.as_actor('owner');
  response := test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', publication_id, 'sessionToken', repeat(md5(label),2)));
  target_attempt := (response->>'attemptId')::uuid;
  for n in 1..(item_count - pending_count) loop
    perform test_support.run('prepare_interaction');
    perform test_support.run('receive_answer', '{"answer":true}');
    perform test_support.run('record_evaluation', jsonb_build_object('status','correct','points',100 / item_count));
  end loop;
  if pending_count > 0 then
    perform test_support.run('prepare_interaction');
    if pending_count > 1 then
      perform pg_sleep(0.01);
      perform test_support.run('pass_interaction');
      perform test_support.run('prepare_interaction');
    end if;
    perform pg_sleep(0.12);
  end if;
  response := test_support.run('complete_attempt', '{"score":0}');
  return next is(response->>'status', 'completed', label || ' completes');
  return next is(jsonb_array_length(response->'answers'), item_count, label || ' returns every answer');
  return next is((select count(*) from private.attempt_answers aa where aa.attempt_id = target_attempt
    and aa.status = 'unanswered'), pending_count::bigint, label || ' closes every pending letter');
  return next is((select count(*) from private.flash_point_entries e where e.attempt_id = target_attempt),
    1::bigint, label || ' accredits once');
  return next is((response->>'score')::integer, (item_count - pending_count) * (100 / item_count), label || ' derives the score');
  return next ok(not exists (select 1 from private.interaction_intervals x where x.attempt_id = target_attempt
    and x.ended_at is null), label || ' closes the open interval');
  return next ok(not exists (select 1 from private.attempt_answers aa where aa.attempt_id = target_attempt
    and aa.time_used_ms > 0 and not exists (select 1 from private.interaction_intervals x where x.attempt_id = aa.attempt_id
      and x.challenge_item_id = aa.challenge_item_id)), label || ' unvisited letters have zero time');
  return next ok(not exists (select 1 from private.answer_receipts r
    join public.attempts a on a.id = r.attempt_id where r.attempt_id = target_attempt
    and not exists (select 1 from private.interaction_intervals x
      where x.attempt_id = r.attempt_id and x.challenge_item_id = r.challenge_item_id)
    and (r.presented_at <> a.deadline_at or r.received_at <> a.deadline_at
      or r.effective_submitted_at <> a.deadline_at)), label || ' unvisited letter dates use the deadline');
  return next ok(not exists (select 1 from private.attempt_answers aa where aa.attempt_id = target_attempt
    and aa.time_used_ms <> coalesce((select sum(floor(extract(epoch from (x.ended_at - x.started_at)) * 1000))::bigint
      from private.interaction_intervals x where x.attempt_id = aa.attempt_id and x.challenge_item_id = aa.challenge_item_id), 0)),
    label || ' preserves accumulated visit times');
  replay := test_support.repeat_last();
  return next is(replay, response, label || ' replays the exact completed result');
  return next is((select count(*) from private.answer_receipts r where r.attempt_id = target_attempt),
    item_count::bigint, label || ' does not duplicate receipts');
  return next is((select array_agg((answer->>'challengeItemId')::uuid order by ord)
    from jsonb_array_elements(response->'answers') with ordinality a(answer,ord)),
    (select array_agg(i.id order by i.position) from private.challenge_items i
      where i.challenge_version_id = test_support.id(label || '-version')), label || ' returns answers in letter order');
end;
$$;
select * from test_support.test_alphabet_completion(0);
select * from test_support.test_alphabet_completion(1);
select * from test_support.test_alphabet_completion(5);
select * from test_support.test_alphabet_completion(18);
select * from test_support.test_alphabet_completion(20);

select test_support.as_actor('member');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet'),'sessionToken',repeat('m',40)));
select throws_ok($$select test_support.run('complete_attempt','{"score":0}')$$,
  '55000', 'alphabet_deadline_not_reached', 'Pending letters cannot be closed before the server deadline');
select is((select count(*) from private.attempt_answers where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  0::bigint, 'Early closure leaves no partial results');

select test_support.as_actor('owner');
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.alphabet_publication('bulk-receipt',2),'sessionToken',repeat('r',40)));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":true}');
select pg_sleep(0.12);
select throws_ok($$select test_support.run('complete_attempt','{"score":0}')$$,
  '55000','unfinished_interaction','An unevaluated receipt must not be overwritten');
select test_support.run('complete_attempt', jsonb_build_object('score',0,'pendingEvaluation',jsonb_build_object(
  'receiptId',(select state->>'receiptId' from test_support.runtime),'status','correct','points',50)));
select is((select (last_result->>'score')::integer from test_support.runtime),50,'Atomic closure retains an on-time pending receipt');
select is((select last_result->'answers'->0->'answer' from test_support.runtime),'true'::jsonb,'Received answer is preserved');
select is((select last_result->'answers'->1->>'status' from test_support.runtime),'unanswered','Other letters close in the same transaction');

select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.alphabet_publication('bulk-rollback',2),'sessionToken',repeat('b',40)));
select pg_sleep(0.12);
create function test_support.fail_alphabet_entry() returns trigger language plpgsql as $$
begin raise exception 'entry_failure'; end; $$;
create trigger test_fail_alphabet_entry before insert on private.flash_point_entries
  for each row execute function test_support.fail_alphabet_entry();
select throws_ok($$select test_support.run('complete_attempt','{"score":0}')$$,
  'P0001','entry_failure','A failed accreditation rolls back the complete operation');
drop trigger test_fail_alphabet_entry on private.flash_point_entries;
select is((select count(*) from private.answer_receipts where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  0::bigint,'Rollback removes synthetic receipts');
select is((select status from public.attempts where id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  'in_progress','Rollback preserves the active attempt');
select ok(exists(select 1 from private.attempt_sessions where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)
  and revoked_at is null),'Rollback preserves the session');
select test_support.run('complete_attempt','{"score":0}');
select is((select (last_result->>'score')::integer from test_support.runtime),0,'An entirely unvisited Alphabet completes with zero points');

select * from finish();
rollback;
