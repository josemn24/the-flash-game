insert into private.challenge_definitions(id,slug,created_by_player_id)
values(test_support.id('ct-cd'),'ct-test',test_support.id('owner'));
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
select test_support.id('ct-cv-'||n),test_support.id('ct-cd'),n,'time-trial','Contrarreloj',
  case when n=2 then 1000 else 60000 end,test_support.id('owner') from generate_series(1,2) n;
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('ct-item-'||n||'-'||p),test_support.id('ct-cv-'||n),
  test_support.id(case when p=1 then 'pyramid-queens-qv' else 'pyramid-queens-timeout-qv' end),p,
  case when p=1 then 30 else 70 end from generate_series(1,2) n cross join generate_series(1,2) p;
update private.challenge_versions set status='published' where id in(test_support.id('ct-cv-1'),test_support.id('ct-cv-2'));
insert into public.rooms(id,slug,title)
select test_support.id('ct-room-'||n),'ct-room-'||n,'Contrarreloj' from generate_series(1,12) n;
insert into public.room_memberships(room_id,player_id,role)
select test_support.id('ct-room-'||n),m.player_id,m.role from public.room_memberships m cross join generate_series(1,12) n
where m.room_id=test_support.id('room-pyramid');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('ct-season-'||n),test_support.id('ct-room-'||n),'CT','active',now()-interval '1 day',now()+interval '1 day'
from generate_series(1,12) n;
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('ct-sc-'||n),test_support.id('ct-season-'||n),
  test_support.id(case when n between 4 and 7 then 'ct-cv-2' else 'ct-cv-1' end),1,'open',now()-interval '1 hour',now()+interval '1 day'
from generate_series(1,12) n;

create function test_support.start_ct(n integer, prepare boolean default true) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  result := test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('ct-sc-'||n),'sessionToken',gen_random_uuid()::text));
  if prepare then result := test_support.run('prepare_interaction'); end if;
  return result;
end;
$$;
create function test_support.solve_ct() returns jsonb language plpgsql as $$
begin
  perform test_support.run('submit_queens_answer','{"queens":[2,9,10,18,21]}');
  return test_support.run('record_evaluation','{"status":"correct","points":1,"resultDetails":{"type":"queens","solved":true}}');
end;
$$;
grant execute on function test_support.start_ct(integer,boolean),test_support.solve_ct() to service_role;

-- Seven boards with the same weights as Tabarnia, under a short test clock.
create function test_support.check_deadline_checkpoint(question_version uuid, solution jsonb, checkpoint jsonb)
returns setof text language plpgsql as $$
declare
  question_type text := (select type from private.question_versions where id = question_version);
  submit_command text := case when question_type = 'queens' then 'submit_queens_answer' else 'receive_answer' end;
  submit_input jsonb := case when question_type = 'queens' then solution else jsonb_build_object('answer', solution) end;
  draft_command text := case when question_type = 'queens' then 'save_queens_draft' else 'save_connect_pairs_draft' end;
  partial_key text := case when question_type = 'queens' then 'queensTimeoutPartialCredit' else 'connectPairsTimeoutPartialCredit' end;
  clock_ms integer := 2000;
  scenario text;
  version_id uuid;
  target_room uuid;
  season_id uuid;
  publication_id uuid;
  completed_attempt uuid;
  player_label text;
  result jsonb;
  ranked_players text[];
  ranked_times bigint[];
begin
  insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
    type, time_limit_ms, public_payload, created_by_player_id)
  select test_support.id('ct-deadline-question-' || board), q.question_definition_id, 80 + board,
    q.payload_schema_version, q.type, q.time_limit_ms, q.public_payload, q.created_by_player_id
  from private.question_versions q cross join generate_series(1,6) as boards(board)
  where q.id = question_version;
  insert into private.question_version_solutions(question_version_id, solution_payload)
  select test_support.id('ct-deadline-question-' || board), s.solution_payload
  from private.question_version_solutions s cross join generate_series(1,6) as boards(board)
  where s.question_version_id = question_version;
  update private.question_versions set status = 'published'
  where id in (select test_support.id('ct-deadline-question-' || board) from generate_series(1,6) as boards(board));

  for version_no in 80..81 loop
    scenario := 'ct-deadline-' || version_no;
    version_id := test_support.id(scenario || '-version');
    target_room := test_support.id(scenario || '-room');
    season_id := test_support.id(scenario || '-season');
    publication_id := test_support.id(scenario || '-publication');
    insert into private.challenge_versions(id, challenge_definition_id, version_number, mode, title,
      global_time_limit_ms, mode_config, created_by_player_id)
    values(version_id, test_support.id('ct-cd'), version_no, 'time-trial', scenario, clock_ms,
      case when version_no = 80 then jsonb_build_object(partial_key, true) else '{}'::jsonb end,
      test_support.id('owner'));
    insert into private.challenge_items(challenge_version_id, question_version_id, position, points)
    select version_id,
      case when position = 7 then question_version else test_support.id('ct-deadline-question-' || position) end,
      position, weight
    from unnest(array[12,13,13,14,15,16,17]) with ordinality as weights(weight, position);
    update private.challenge_versions set status = 'published' where id = version_id;
    insert into public.rooms(id, slug, title) values(target_room, scenario, scenario);
    insert into public.room_memberships(room_id, player_id, role)
    select target_room, m.player_id, m.role from public.room_memberships m
    where m.room_id = test_support.id('room-pyramid');
    insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
    values(season_id, target_room, scenario, 'active', now()-interval '1 day', now()+interval '1 day');
    insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
    values(publication_id, season_id, version_id, 1, 'open', now()-interval '1 hour', now()+interval '1 day');

    set local role service_role;
    foreach player_label in array array['member', 'owner'] loop
      perform test_support.as_actor(player_label);
      perform test_support.run('start_attempt',
        jsonb_build_object('scheduledChallengeId', publication_id, 'sessionToken', gen_random_uuid()));
      for board in 1..7 loop
        perform test_support.run('prepare_interaction');
        if board = 7 and player_label = 'owner' then
          perform test_support.run(draft_command, checkpoint);
        else
          perform test_support.run(submit_command, submit_input);
          perform test_support.run('record_evaluation', '{"status":"correct","points":1}');
        end if;
      end loop;
      if player_label = 'member' then perform test_support.run('complete_attempt'); end if;
    end loop;

    completed_attempt := (select (state->>'attemptId')::uuid from test_support.runtime);
    perform pg_sleep(greatest(0, (select extract(epoch from (deadline_at - clock_timestamp()))
      from public.attempts where id = completed_attempt)) + 0.05);
    return next throws_ok(format('select test_support.run(%L,%L::jsonb)', submit_command, submit_input),
      '55000', 'deadline_reached', scenario || ': a late answer cannot replace the checkpoint');
    result := test_support.run('complete_attempt');
    return next ok(result @> jsonb_build_object('score', 100, 'terminalReason', 'all_solved',
      'timeTrial', jsonb_build_object('solvedCount', 7, 'lastCorrectElapsedMs', clock_ms, 'elapsedTimeMs', clock_ms)),
      scenario || ': seven boards and 100 points with the deadline as the last correct time');
    return next ok(result->'answers'->6 @> jsonb_build_object('status', 'correct', 'points', 17,
      'reviewState', checkpoint || jsonb_build_object('type', question_type)),
      scenario || ': the final board has its full weight and the saved solution for review');
    return next is(test_support.repeat_last(), result, scenario || ': replay returns the same result');
    reset role;

    return next is((select array_agg(amount) from private.flash_point_entries e
      where e.attempt_id = completed_attempt),
      array[100], scenario || ': one accreditation for 100 points');
    set local role authenticated;
    select array_agg(display_name order by position), array_agg(last_correct_elapsed_ms order by position)
      into ranked_players, ranked_times
    from public.get_challenge_ranking(publication_id)
    where solved_count = 7 and flash_points = 100;
    return next is(ranked_players, array['member','owner'],
      scenario || ': an earlier validation wins the tie');
    return next ok(ranked_times[1] < clock_ms and ranked_times[2] = clock_ms,
      scenario || ': ranking distinguishes receipt time from the deadline');
    reset role;
    update public.scheduled_challenges set status = 'closed' where id = publication_id;
    set local role authenticated;
    return next is((select array_agg(display_name order by position)
      from public.get_room_history(scenario, publication_id)), ranked_players,
      scenario || ': history and ranking show the same order');
    return next is((select array_agg(duration_ms order by position)
      from public.get_room_history(scenario, publication_id)), ranked_times,
      scenario || ': history and ranking show the same times');
    reset role;
  end loop;
end;
$$;
