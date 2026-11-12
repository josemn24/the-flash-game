-- Guarded checkpoint writes for incomplete Connect Pairs paths.
set local check_function_bodies = off;

create function private.save_connect_pairs_draft(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  snapshot jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','paths'
    ]))
    or jsonb_typeof(input->'paths') is distinct from 'object' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'save_connect_pairs_draft' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  perform private.authorize_attempt_replay((input->>'attemptId')::uuid, safe_input->>'sessionToken');
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    perform private.raise_if_session_transferred(a.id, safe_input->>'sessionToken');
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  instant := clock_timestamp();
  if a.deadline_at is not null and instant >= a.deadline_at
    and exists (select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id and cv.mode = 'time-trial') then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  if instant >= unit.deadline_at and exists (
    select 1 from private.challenge_versions cv where cv.id = a.challenge_version_id
      and cv.mode = 'pyramid' and cv.mode_config->'connectPairsTimeoutPartialCredit' = 'true'::jsonb
  ) then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'connect-pairs' or question.payload_schema_version <> 1
    or not private.connect_pairs_draft_valid(question.public_payload, jsonb_build_object('paths', input->'paths')) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  snapshot := jsonb_build_object('type', 'connect-pairs', 'paths', input->'paths');
  update public.attempts set
    progress_payload = jsonb_build_object('kind', 'connect-pairs', 'challengeItemId', item.id,
      'paths', input->'paths', 'savedAt', instant),
    lock_version = lock_version + 1,
    last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object('attemptId', a.id, 'challengeItemId', item.id,
    'lockVersion', a.lock_version, 'reviewState', snapshot);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'save_connect_pairs_draft', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'save_connect_pairs_draft', safe_input, result);
  return result;
end;
$$;

alter function private.save_connect_pairs_draft(jsonb) owner to postgres;
revoke all on function private.save_connect_pairs_draft(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.save_connect_pairs_draft(jsonb) to service_role;
