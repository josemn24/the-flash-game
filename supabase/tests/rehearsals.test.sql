begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures
select ok(not has_table_privilege('authenticated','private.challenge_rehearsals','SELECT'), 'players cannot read raw references');
select ok(not has_table_privilege('service_role','private.challenge_rehearsals','INSERT'), 'server writes use guarded commands');
select ok(not has_function_privilege('authenticated','private.read_player_rehearsal(text,uuid)','EXECUTE'), 'source projection is never exposed through PostgREST');
select ok(not has_function_privilege('authenticated','private.set_challenge_rehearsal(jsonb)','EXECUTE'), 'browser cannot submit arbitrary catalog references');
select is((select count(*) from private.challenge_rehearsals),0::bigint,'migration creates no automatic associations');
select test_support.as_actor('superadmin');
create temp table rehearsal_input(body jsonb);
grant select on rehearsal_input to service_role;
insert into rehearsal_input select jsonb_build_object('challengeVersionId',test_support.id('cv-flash'),
  'expectedUpdatedAt',v.updated_at,'sourceHash',private.read_editorial_rehearsal(v.id)->>'sourceHash',
  'idempotencyKey','rehearsal-test-original','reason','Prueba del catálogo',
  'ref',jsonb_build_object('id','flash-prueba','version',1,'contentHash',repeat('a',64)))
from private.challenge_versions v where id=test_support.id('cv-flash');
set local role service_role;
select is(private.set_challenge_rehearsal((select body from rehearsal_input))->'ref',
  (select body->'ref' from rehearsal_input),'published legacy version accepts its first explicit association');
select is(private.set_challenge_rehearsal((select body from rehearsal_input))->'ref',
  (select body->'ref' from rehearsal_input),'exact replay is idempotent');
select throws_ok($$select private.set_challenge_rehearsal((select body from rehearsal_input) || '{"reason":"otro"}')$$,
  '40001','idempotency_conflict','same key cannot change the input');
select throws_ok($$select private.set_challenge_rehearsal((select body from rehearsal_input) || '{"idempotencyKey":"rehearsal-test-replace"}')$$,
  '55000','rehearsal_binding_frozen','published association cannot be replaced');
reset role;
select is((select count(*) from private.audit_log where action='set_challenge_rehearsal'),1::bigint,'one audit record despite replay');
select is((select count(*) from public.attempts),0::bigint,'association creates no official attempt');
select test_support.as_actor('member');
set local role service_role;
select ok(private.read_player_rehearsal('commands-flash',test_support.id('sc-flash')) is not null,'authorized member can open the rehearsal');
select throws_ok($$select private.read_editorial_rehearsal(test_support.id('cv-flash'))$$,'42501','not_authorized','member cannot use editorial projection');
reset role;
select is((select count(*) from public.attempts),0::bigint,'opening a rehearsal does not create an attempt');
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('sc-rehearsal-future'),test_support.id('season-flash'),test_support.id('cv-flash'),3,'scheduled',now()+interval '25 hours',now()+interval '26 hours');
select ok(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')) is not null,'practice is available before competitive opening');
update public.room_memberships set status='removed',ended_at=now() where room_id=test_support.id('room-flash') and player_id=test_support.id('member');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'membership loss denies direct access');
update public.room_memberships set status='active',ended_at=null where room_id=test_support.id('room-flash') and player_id=test_support.id('member');
update public.rooms set status='deleted',deleted_at=now() where id=test_support.id('room-flash');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'inactive room denies access');
update public.rooms set status='active',deleted_at=null where id=test_support.id('room-flash');
select test_support.as_actor('spectator');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'spectator cannot open it');
select test_support.as_actor('outsider');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'outsider cannot open it');
select test_support.as_actor('member');
update public.scheduled_challenges set status='closed' where id=test_support.id('sc-rehearsal-future');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'closed publication denies access');
update public.scheduled_challenges set status='cancelled',cancelled_at=now() where id=test_support.id('sc-rehearsal-future');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal-future')),null::jsonb,'cancelled publication cannot be rehearsed');
update public.scheduled_challenges set status='cancelled',cancelled_at=now() where id=test_support.id('sc-flash');
-- Use another publication for the same immutable version to verify independent authorization.
insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,status,opens_at,closes_at)
values(test_support.id('sc-rehearsal'),test_support.id('season-flash'),test_support.id('cv-flash'),2,'open',now()-interval '1 minute',now()+interval '1 hour');
select ok(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal')) is not null,'same version reuses the reference in another publication');
set local role service_role;
select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-rehearsal'),'sessionToken',repeat('r',40)));
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal')),null::jsonb,'official attempt hides the rehearsal');
select test_support.run('abandon_attempt');
select is(private.read_player_rehearsal('commands-flash',test_support.id('sc-rehearsal')),null::jsonb,'abandoned attempt also hides the rehearsal');
reset role;
select test_support.as_actor('superadmin');
insert into private.challenge_versions(id,challenge_definition_id,version_number,mode,title,created_by_player_id)
values(test_support.id('cv-rehearsal-draft'),test_support.id('cd-flash'),2,'flash','Borrador de prueba',test_support.id('superadmin'));
insert into private.challenge_items(id,challenge_version_id,question_version_id,position,points)
select test_support.id('rehearsal-item-'||n),test_support.id('cv-rehearsal-draft'),test_support.id('qv-normal'||case when n=2 then '-2' else '' end),n,50 from generate_series(1,2)n;
truncate rehearsal_input;
insert into rehearsal_input select jsonb_build_object('challengeVersionId',v.id,'expectedUpdatedAt',v.updated_at,
  'sourceHash',private.read_editorial_rehearsal(v.id)->>'sourceHash','idempotencyKey','rehearsal-draft-original','reason','Preparación',
  'ref',jsonb_build_object('id','draft-prueba','version',1,'contentHash',repeat('b',64)))
from private.challenge_versions v where id=test_support.id('cv-rehearsal-draft');
select private.set_challenge_rehearsal((select body from rehearsal_input));
select is((select count(*) from private.challenge_rehearsals where challenge_version_id=test_support.id('cv-rehearsal-draft')),1::bigint,'draft accepts association');
select throws_ok($$select private.set_challenge_rehearsal((select body from rehearsal_input) || '{"idempotencyKey":"rehearsal-stale-editor","expectedUpdatedAt":"2000-01-01T00:00:00Z"}')$$,
  '40001','content_conflict','stale editor cannot overwrite a draft selection');
select throws_ok($$select private.set_challenge_rehearsal((select body from rehearsal_input) || '{"idempotencyKey":"rehearsal-stale-content","sourceHash":"changed"}')$$,
  '40001','content_conflict','concurrent content changes prevent association');
update private.challenge_items set points=49 where id=test_support.id('rehearsal-item-1');
select is((select count(*) from private.challenge_rehearsals where challenge_version_id=test_support.id('cv-rehearsal-draft')),0::bigint,'editing the draft invalidates the association');
update private.challenge_items set points=50 where id=test_support.id('rehearsal-item-1');
truncate rehearsal_input;
insert into rehearsal_input select jsonb_build_object('challengeVersionId',v.id,'expectedUpdatedAt',v.updated_at,
  'sourceHash',private.read_editorial_rehearsal(v.id)->>'sourceHash','idempotencyKey','rehearsal-before-publication','reason','Publicación',
  'ref',jsonb_build_object('id','draft-prueba','version',1,'contentHash',repeat('b',64)))
from private.challenge_versions v where id=test_support.id('cv-rehearsal-draft');
select private.set_challenge_rehearsal((select body from rehearsal_input));
update private.challenge_versions set status='published' where id=test_support.id('cv-rehearsal-draft');
select is((select count(*) from private.challenge_rehearsals where challenge_version_id=test_support.id('cv-rehearsal-draft')),1::bigint,'publishing preserves the selected artifact');
select throws_ok($$delete from private.challenge_rehearsals where challenge_version_id=test_support.id('cv-rehearsal-draft')$$,
  '55000','rehearsal_binding_frozen','publishing freezes the former draft association');
select is(private.read_editorial_rehearsal(test_support.id('cv-narrative')),null::jsonb,'narrative does not participate in the rehearsal catalog');
select * from finish();
rollback;
