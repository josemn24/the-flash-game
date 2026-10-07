begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

-- Exercise the real trigger and CHECKs, including test attempts, without disabling guards.
create sequence test_support.lifecycle_attempt_number;
create function test_support.lifecycle_error(mode_value text, status_value text, outcome_value text)
returns text language plpgsql as $$
declare attempt_id uuid; terminal_status text;
begin
  insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id,
    kind, attempt_number, client_state_schema_version)
  values(test_support.id('superadmin'), test_support.id('sc-' || mode_value),
    test_support.id('cv-' || mode_value), 'test',
    nextval('test_support.lifecycle_attempt_number'), 1)
  returning id into attempt_id;
  terminal_status := case when status_value = 'invalidated'
    then case when outcome_value is null then 'abandoned' else 'completed' end
    else status_value end;
  update public.attempts set status = terminal_status, outcome = outcome_value,
    score = case when terminal_status = 'completed' then 0 end,
    completed_at = case when terminal_status <> 'in_progress' then clock_timestamp() end,
    lock_version = lock_version + 1 where id = attempt_id;
  if status_value = 'invalidated' then
    update public.attempts set status = 'invalidated', lock_version = lock_version + 1
    where id = attempt_id;
  end if;
  return null;
exception when others then
  return sqlstate;
end;
$$;

select ok(
  (test_support.lifecycle_error(mode, status, outcome) is null) =
    case
      when status in ('in_progress', 'abandoned') then outcome is null
      when status = 'completed' then
        case mode when 'survival' then coalesce(outcome in ('survived','eliminated'), false)
          when 'pyramid' then coalesce(outcome in ('summit','failed'), false)
          else outcome is null end
      when status = 'invalidated' then
        outcome is null or case mode when 'survival' then outcome in ('survived','eliminated')
          when 'pyramid' then outcome in ('summit','failed') else false end
      else false
    end,
  format('Lifecycle %s / %s / %s', mode, status, coalesce(outcome,'null'))
)
from unnest(array['flash','alphabet','narrative','survival','pyramid']) mode
cross join unnest(array['in_progress','abandoned','completed','invalidated']) status
cross join unnest(array[null,'survived','eliminated','summit','failed','passed','unknown']) outcome;

-- Invalidation must preserve the exact previous terminal result, including null.
insert into public.attempts(id,player_id,scheduled_challenge_id,challenge_version_id,
  kind,attempt_number,client_state_schema_version)
values(test_support.id('lifecycle-preserve'),test_support.id('superadmin'),test_support.id('sc-survival'),
  test_support.id('cv-survival'),'test',nextval('test_support.lifecycle_attempt_number'),1);
update public.attempts set status='completed', outcome='eliminated', score=0,
  completed_at=clock_timestamp(), lock_version=lock_version+1 where id=test_support.id('lifecycle-preserve');
select throws_ok($$update public.attempts set status='invalidated', outcome='survived',
  lock_version=lock_version+1 where id=test_support.id('lifecycle-preserve')$$,
  'P0001','Terminal attempts cannot be replayed or overwritten',
  'Invalidation cannot replace elimination with another otherwise valid outcome');
select lives_ok($$update public.attempts set status='invalidated',lock_version=lock_version+1
  where id=test_support.id('lifecycle-preserve')$$,'Invalidation preserves the terminal result');
select is((select outcome from public.attempts where id=test_support.id('lifecycle-preserve')),
  'eliminated','Invalidated outcome remains eliminated');
select is((select score from public.attempts where id=test_support.id('lifecycle-preserve')),
  0,'Invalidation preserves the original zero score');

-- A recovery hint is independent from the still-active persisted result.
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-survival')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select is((select private.read_attempt_recovery((state->>'attemptId')::uuid,state->>'sessionToken')->>'status'
  from test_support.runtime),'in_progress','Terminal hint can precede completion');
select is((select private.read_attempt_recovery((state->>'attemptId')::uuid,state->>'sessionToken')->'outcome'
  from test_support.runtime),'null'::jsonb,'Recovery explicitly projects the persisted null result');
select is((select private.read_attempt_recovery((state->>'attemptId')::uuid,state->>'sessionToken')->>'terminalOutcome'
  from test_support.runtime),'eliminated','Recovery independently derives elimination');
select test_support.run('complete_attempt','{"score":100,"outcome":"survived"}');
select is((select last_result->>'challengeMode' from test_support.runtime),'survival','Completion includes its frozen mode');
select is((select last_result->>'outcome' from test_support.runtime),'eliminated','Completion ignores forged outcome');
select is(test_support.repeat_last(),(select last_result from test_support.runtime),'Retry retains exactly the same completion contract');
select is((select private.read_completed_attempt((state->>'attemptId')::uuid)->'result'->>'outcome'
  from test_support.runtime),'eliminated','Lost completion can be read without a controller cookie');
reset role;
select is((select count(*) from private.flash_point_entries where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime)),
  1::bigint,'Repeated terminal reads and commands never duplicate accreditation');

-- Flash and Narrative zero-point closures always project explicit null, including receipt reads.
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select test_support.run('complete_attempt','{"score":0,"outcome":"passed"}');
select is((select last_result->'outcome' from test_support.runtime),'null'::jsonb,'Flash command ignores any caller outcome');
select is((select private.read_completed_attempt((state->>'attemptId')::uuid)->'result'->'outcome'
  from test_support.runtime),'null'::jsonb,'Lost Flash confirmation retains explicit null');

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-narrative')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer','{"answer":false}');
select test_support.run('record_evaluation','{"status":"incorrect","points":0}');
select test_support.run('complete_attempt','{"score":0,"outcome":"failed"}');
select is((select last_result->'outcome' from test_support.runtime),'null'::jsonb,'Narrative zero-point completion has null outcome');
select is((select private.read_completed_attempt((state->>'attemptId')::uuid)->'result'->>'challengeMode'
  from test_support.runtime),'narrative','Terminal reads project the correct Narrative mode');

select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-pyramid')));
select test_support.run('abandon_attempt');
select is((select last_result->'outcome' from test_support.runtime),'null'::jsonb,'Abandonment explicitly returns null');
select is((select private.read_abandoned_attempt((state->>'attemptId')::uuid)->'result'->'outcome'
  from test_support.runtime),'null'::jsonb,'Lost abandonment confirmation retains explicit null');
select is((select private.read_abandoned_attempt((state->>'attemptId')::uuid)->'result'->>'challengeMode'
  from test_support.runtime),'pyramid','Abandonment receipt projects the version mode');

reset role;
select * from finish();
rollback;
