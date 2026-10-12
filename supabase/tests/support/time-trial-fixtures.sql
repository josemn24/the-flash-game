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
