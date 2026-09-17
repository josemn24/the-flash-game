-- Disposable fixtures, loaded only by check-supabase-schema.mjs in its random database.
create schema test_support;
create function test_support.id(label text) returns uuid language sql immutable as $$ select md5('commands:' || label)::uuid $$;
create function test_support.as_actor(label text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',test_support.id('auth-'||label),'is_anonymous',false)::text,true);
end;
$$;
insert into auth.users(id) select test_support.id('auth-'||n) from unnest(array['owner','member','member2','spectator','outsider','superadmin']) n;
insert into public.players(id,auth_user_id,display_name)
select test_support.id(n),test_support.id('auth-'||n),n from unnest(array['owner','member','member2','spectator','outsider','superadmin']) n;
insert into private.platform_role_assignments(player_id,role) values(test_support.id('superadmin'),'superadmin');
insert into public.rooms(id,slug,title)
select test_support.id('room-'||m), 'commands-'||m,m from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m;
insert into public.room_memberships(room_id,player_id,role)
select r.id,test_support.id(n),case n when 'owner' then 'owner' when 'spectator' then 'spectator' else 'member' end
from public.rooms r cross join unnest(array['owner','member','member2','spectator']) n;
set constraints all immediate;
set constraints all deferred;
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
select test_support.id('season-'||m),test_support.id('room-'||m),m,'active',now()-interval '2 days',now()+interval '2 days'
from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m;
insert into private.question_definitions(id,slug,created_by_player_id)
select test_support.id('q-'||m),'commands-q-'||m,test_support.id('superadmin') from unnest(array['normal','fast']) m;
insert into private.question_versions(id,question_definition_id,version_number,type,time_limit_ms,public_payload,created_by_player_id)
select test_support.id('qv-'||m),test_support.id('q-'||m),1,'true-false',case m when 'fast' then 10 else 60000 end,
  '{"prompt":"Test?"}',test_support.id('superadmin') from unnest(array['normal','fast']) m;
insert into private.question_version_solutions(question_version_id,solution_payload)
select id,'{"correctAnswer":true}' from private.question_versions;
update private.question_versions set status='published';
insert into private.challenge_definitions(id,slug,created_by_player_id)
select test_support.id('cd-'||m),'commands-cd-'||m,test_support.id('superadmin') from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m;
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,global_time_limit_ms,created_by_player_id)
select test_support.id('cv-'||m),test_support.id('cd-'||m),1,case when m='fast' then 'flash' when m='alphabet-fast' then 'alphabet' else m end,m,
  case when m='alphabet' then 60000 when m='alphabet-fast' then 100 else null end,test_support.id('superadmin')
from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m;
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('item-'||m||'-'||n),test_support.id('cv-'||m),test_support.id('qv-'||case when m='fast' then 'fast' else 'normal' end),n,50
from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m cross join generate_series(1,2) n;
update private.challenge_versions set status='published';
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
select test_support.id('sc-'||m),test_support.id('season-'||m),test_support.id('cv-'||m),1,'open',now()-interval '1 day',now()+interval '1 day'
from unnest(array['flash','alphabet','survival','narrative','pyramid','fast','alphabet-fast']) m;
insert into private.room_invitations(id,room_id,created_by_player_id,role,token_hash,expires_at,max_uses)
values(test_support.id('invite'),test_support.id('room-flash'),test_support.id('owner'),'member',
  encode(sha256(convert_to(repeat('i',40),'UTF8')),'hex'),now()+interval '1 day',1);

-- The harness maintains the client request state; it never writes production tables.
create table test_support.runtime(state jsonb not null, last_command text, last_input jsonb, last_result jsonb);
insert into test_support.runtime(state) values(jsonb_build_object('sessionToken',repeat('s',40)));
create function test_support.run(command text, changes jsonb default '{}') returns jsonb
language plpgsql as $$
declare body jsonb; s jsonb; result jsonb; keys text[];
begin
  select state into s from test_support.runtime;
  case command
    when 'start_attempt' then keys:=array['scheduledChallengeId','sessionToken'];
    when 'take_over_attempt' then keys:=array['attemptId','lockVersion','newSessionToken'];
    when 'prepare_interaction' then keys:=array['attemptId','lockVersion','sessionToken'];
    when 'receive_answer' then keys:=array['attemptId','lockVersion','sessionToken','challengeItemId'];
    when 'submit_mini_wordle_guess' then keys:=array['attemptId','lockVersion','sessionToken','challengeItemId'];
    when 'pass_interaction' then keys:=array['attemptId','lockVersion','sessionToken','challengeItemId'];
    when 'record_evaluation' then keys:=array['attemptId','lockVersion','sessionToken','receiptId'];
    when 'complete_attempt' then keys:=array['attemptId','lockVersion','sessionToken'];
    when 'abandon_attempt' then keys:=array['attemptId','lockVersion','sessionToken'];
    when 'recover_attempt' then keys:=array['attemptId','lockVersion','sessionToken'];
    when 'accept_invitation' then keys:=array[]::text[];
    when 'invalidate_attempt' then keys:=array['attemptId','lockVersion'];
    when 'adjust_result' then keys:=array['attemptId','lockVersion'];
    else raise exception 'unknown test command';
  end case;
  select coalesce(jsonb_object_agg(k,v),'{}') into body from jsonb_each(s) e(k,v) where k=any(keys);
  body:=body||jsonb_build_object('idempotencyKey',gen_random_uuid())||changes;
  execute format('select private.%I($1)',command) into result using body;
  s:=s||body||result;
  if command='take_over_attempt' then s:=s||jsonb_build_object('sessionToken',body->>'newSessionToken'); end if;
  update test_support.runtime set state=s,last_command=command,last_input=body,last_result=result;
  return result;
end;
$$;
create function test_support.repeat_last(changes jsonb default '{}') returns jsonb language plpgsql as $$
declare cmd text; body jsonb; result jsonb;
begin
  select last_command,last_input into cmd,body from test_support.runtime;
  execute format('select private.%I($1)',cmd) into result using body||changes;
  return result;
end;
$$;
grant usage on schema test_support to anon,authenticated,service_role;
grant execute on all functions in schema test_support to anon,authenticated,service_role;
grant select,update on test_support.runtime to service_role;
