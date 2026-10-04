-- Effective history/review closure without calendar:tick, and Alphabet metadata.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

set local session_replication_role = replica;
update public.scheduled_challenges set closes_at = now() - interval '1 minute'
where id in (test_support.id('sc-flash'), test_support.id('sc-alphabet'),
  test_support.id('sc-survival'), test_support.id('sc-narrative'), test_support.id('sc-pyramid'));
update public.scheduled_challenges set status = 'scheduled' where id = test_support.id('sc-alphabet');
insert into private.question_definitions(id, slug, created_by_player_id)
select test_support.id('history-alpha-q-' || n), 'history-alpha-q-' || n, test_support.id('owner')
from generate_series(1,4) n;
insert into private.question_versions(id, question_definition_id, version_number, status, type,
  time_limit_ms, public_payload, created_by_player_id, published_at)
select test_support.id('history-alpha-qv-' || n), test_support.id('history-alpha-q-' || n),
  1, 'archived', 'short-text', 60000, jsonb_build_object('question', 'Letra ' || n), test_support.id('owner'), now()
from generate_series(1,4) n;
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('history-alpha-qv-' || n),
  '{"correctAnswer":"Lovelace","acceptedAnswers":["Lovelace"],"explanation":"Historical Alphabet solution"}'::jsonb
from generate_series(1,4) n;
delete from private.challenge_items where challenge_version_id = test_support.id('cv-alphabet');
insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, mode_config)
select test_support.id('history-alpha-item-' || n), test_support.id('cv-alphabet'),
  test_support.id('history-alpha-qv-' || n), n, 25,
  jsonb_build_object('letter', (array['B','A','Ñ','Z'])[n])
from generate_series(1,4) n;
update private.challenge_versions set status = 'archived' where id = test_support.id('cv-alphabet');
insert into public.attempts(id, player_id, scheduled_challenge_id, challenge_version_id, kind,
  status, started_at, completed_at, score, client_state_schema_version, last_activity_at)
values
  (test_support.id('history-alpha-completed'), test_support.id('member'), test_support.id('sc-alphabet'),
    test_support.id('cv-alphabet'), 'competitive', 'completed', now()-interval '1 hour', now()-interval '30 minutes', 25, 1, now()),
  (test_support.id('history-alpha-abandoned'), test_support.id('member2'), test_support.id('sc-alphabet'),
    test_support.id('cv-alphabet'), 'competitive', 'abandoned', now()-interval '1 hour', now()-interval '30 minutes', null, 1, now()),
  (test_support.id('history-flash-completed'), test_support.id('member'), test_support.id('sc-flash'),
    test_support.id('cv-flash'), 'competitive', 'completed', now()-interval '1 hour', now()-interval '30 minutes', 50, 1, now()),
  (test_support.id('history-flash-recent'), test_support.id('owner'), test_support.id('sc-flash'),
    test_support.id('cv-flash'), 'competitive', 'in_progress', now()-interval '1 hour', null, null, 1, now()),
  (test_support.id('history-flash-stale'), test_support.id('member2'), test_support.id('sc-flash'),
    test_support.id('cv-flash'), 'competitive', 'in_progress', now()-interval '1 hour', null, null, 1, now()-interval '16 minutes');
insert into private.attempt_sessions(attempt_id, session_token_hash)
values(test_support.id('history-flash-stale'), repeat('b',64));
insert into private.answer_receipts(id, attempt_id, challenge_item_id, challenge_version_id, answer,
  presented_at, received_at, effective_submitted_at, time_used_ms, timed_out)
select test_support.id('history-alpha-receipt-' || n), test_support.id('history-alpha-completed'),
  test_support.id('history-alpha-item-' || n), test_support.id('cv-alphabet'),
  case n when 1 then '"Lovelace"'::jsonb when 2 then '"Other"'::jsonb else 'null'::jsonb end,
  now()-interval '45 minutes', now()-interval '44 minutes', now()-interval '44 minutes', 1000, n=3
from generate_series(1,3) n;
insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
  status, answer, result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
select test_support.id('history-alpha-completed'), test_support.id('history-alpha-item-' || n),
  test_support.id('cv-alphabet'), test_support.id('history-alpha-receipt-' || n),
  (array['correct','incorrect','timeout'])[n],
  case n when 1 then '"Lovelace"'::jsonb when 2 then '"Other"'::jsonb else 'null'::jsonb end,
  '{}', case n when 1 then 25 else 0 end, now()-interval '45 minutes', now()-interval '44 minutes', 1000,
  'history-alpha-answer-' || n
from generate_series(1,3) n;

-- A completed current challenge stays out; raw scheduled maps to effective open for self review.
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values(test_support.id('history-current'), test_support.id('season-flash'), test_support.id('cv-flash'),
  2, 'scheduled', now()-interval '30 seconds', now()+interval '1 hour');
insert into public.attempts(id, player_id, scheduled_challenge_id, challenge_version_id, kind, status,
  completed_at, score, client_state_schema_version)
values(test_support.id('history-current-attempt'), test_support.id('member'), test_support.id('history-current'),
  test_support.id('cv-flash'), 'competitive', 'completed', now(), 50, 1);
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
select test_support.id('history-season-' || status), test_support.id('room-flash'), status, status,
  now()-interval '2 days', now()+interval '2 days'
from unnest(array['draft','scheduled','cancelled']) status;
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select test_support.id('history-excluded-' || status), test_support.id('history-season-' || status),
  test_support.id('cv-flash'), 1, 'scheduled', now()-interval '2 hours', now()-interval '1 hour'
from unnest(array['draft','scheduled','cancelled']) status;
set local session_replication_role = origin;

select is(private.publication_effective_status('scheduled','active', now()-interval '1 day', now()+interval '1 day', now()-interval '1 hour', now(), now()), 'closed', 'Exact closing instant is closed');
select is(private.publication_effective_status('open','active', now()-interval '1 day', now()+interval '1 day', now()-interval '1 hour', now(), now()-interval '1 microsecond'), 'available', 'Immediately before close remains available');
select is(private.publication_effective_status('open','active', now()-interval '1 day', now(), now()-interval '1 hour', now()+interval '1 hour', now()), 'closed', 'Season ending is an effective closing boundary');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.get_room_member_review(text,uuid,uuid)'::regprocedure), 'postgres', 'Recreated review retains postgres ownership');
select test_support.as_actor('owner');
set local role authenticated;
select is((select publication_status from public.get_room_history('commands-alphabet') limit 1), 'closed', 'Expired raw scheduled publication returns effective closed');
select is((select count(*) from public.get_room_history('commands-flash')), 0::bigint, 'Recent and stale in-progress attempts block history; current completed and excluded seasons stay out');
select is((select count(*) from public.get_room_member_review('commands-flash', test_support.id('sc-flash'), test_support.id('member'))), 0::bigint, 'In-progress attempts block peer review');
select is((select count(*) from public.get_room_member_review('commands-flash', test_support.id('history-current'), test_support.id('member'))), 0::bigint, 'Current completed peer stays private');
select is((select string_agg(alphabet_letter, ',' order by item_position) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member'))), 'B,A,Ñ,Z', 'Alphabet includes every original letter in order');
select is((select count(*) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member')) where global_time_limit_ms=60000 and question_type='short-text' and publication_status='closed'), 4::bigint, 'Alphabet exposes global deadline and short-text review metadata');
select is((select string_agg(coalesce(answer_status,'absent'), ',' order by item_position) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member'))), 'correct,incorrect,timeout,absent', 'Correct, incorrect, timed out and absent answers survive projection');
select is((select count(*) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member2')) where solution_payload is not null and not has_persisted_answer), 4::bigint, 'Abandonment keeps all letter solutions for authorized review');
select is((select count(*) from public.get_room_member_review('commands-flash', test_support.id('sc-alphabet'), test_support.id('member'))), 0::bigint, 'Review cannot cross room boundary');
select is((select count(*) from public.get_room_history('commands-survival')), 1::bigint, 'Expired open Survival without results stays visible');
select is((select count(*) from public.get_room_history('commands-narrative')), 1::bigint, 'Expired open Narrative without results stays visible');
select is((select count(*) from public.get_room_history('commands-pyramid')), 1::bigint, 'Expired open Pyramid without results stays visible');
reset role;
select test_support.as_actor('member');
set local role authenticated;
select is((select publication_status from public.get_room_member_review('commands-flash', test_support.id('history-current'), test_support.id('member')) limit 1), 'open', 'Own terminal attempt stays reviewable with raw scheduled state during its window');
reset role;
set local role service_role;
select is((private.expire_stale_attempts('{"runId":"history-effective-expire","roomSlug":"commands-flash"}')->>'abandonedAttempts')::integer, 1, 'Effective closure expires inactive attempt without tick or deadline');
select is((select status from public.attempts where id=test_support.id('history-flash-recent')), 'in_progress', 'Recent activity preserves its in-progress attempt');
select is((select count(*) from private.attempt_sessions where attempt_id=test_support.id('history-flash-stale') and revoked_at is not null), 1::bigint, 'Expiration still revokes sessions');
select is((select count(*) from private.audit_log where entity_id=test_support.id('history-flash-stale') and action='expire_stale_attempt'), 1::bigint, 'Expiration still writes audit');
reset role;
update public.attempts set last_activity_at=now()-interval '16 minutes', lock_version=lock_version+1 where id=test_support.id('history-flash-recent');
set local role service_role;
select is((private.expire_stale_attempts('{"runId":"history-effective-expire-recent","roomSlug":"commands-flash"}')->>'abandonedAttempts')::integer, 1, 'Attempt expires after the same fifteen-minute inactivity threshold');
reset role;
select test_support.as_actor('owner');
set local role authenticated;
select is((select publication_status from public.get_room_history('commands-flash') limit 1), 'closed', 'No remaining in-progress attempts makes expired raw open history eligible');
select is((select count(*) from public.get_room_member_review('commands-flash', test_support.id('sc-flash'), test_support.id('member')) where global_time_limit_ms is null and alphabet_letter is null), 2::bigint, 'Closed Flash peer review works and Alphabet fields stay null');
reset role;
select test_support.as_actor('spectator');
set local role authenticated;
select is((select count(*) from public.get_room_history('commands-alphabet')), 1::bigint, 'Spectator can see Alphabet ranking without solutions');
select is((select count(*) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member'))), 0::bigint, 'Spectator cannot review Alphabet through the RPC');
reset role;
set local session_replication_role = replica;
update public.scheduled_challenges set status='cancelled', cancelled_at=now() where id=test_support.id('sc-alphabet');
set local session_replication_role = origin;
select test_support.as_actor('owner');
set local role authenticated;
select is((select count(*) from public.get_room_history('commands-alphabet')), 0::bigint, 'Cancellation excludes even effectively ended Alphabet');
select is((select count(*) from public.get_room_member_review('commands-alphabet', test_support.id('sc-alphabet'), test_support.id('member'))), 0::bigint, 'Cancellation also denies answers');
select * from finish();
rollback;
