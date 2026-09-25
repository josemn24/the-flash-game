-- E02 — Logic-code authoritative attempt events.
-- Candidate codes are private events; the browser receives only safe progress
-- and terminal evaluation data.

create table private.logic_code_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  code text not null check (code <> '' and code ~ '^[0-9]+$'),
  correct boolean not null,
  penalty_applied boolean not null,
  received_at timestamptz not null,
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, challenge_item_id, code),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (received_at >= presented_at)
);

create index logic_code_events_item_idx
  on private.logic_code_attempt_events(attempt_id, challenge_item_id, sequence);

create function private.logic_code_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kind', 'logic-code',
    'submittedCodes', coalesce(
      jsonb_agg(e.code order by e.sequence) filter (where e.id is not null),
      '[]'::jsonb
    ),
    'incorrectAttempts', count(*) filter (where e.id is not null and not e.correct)::integer
  )
  from private.logic_code_attempt_events e
  where e.attempt_id = target_attempt and e.challenge_item_id = target_item
$$;

create function private.submit_logic_code_attempt(input jsonb) returns jsonb
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
  solution private.question_version_solutions%rowtype;
  event private.logic_code_attempt_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  code_length integer;
  sequence_no integer;
  incorrect_attempts integer;
  normalized_code text;
  normalized_solution text;
  solved boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code','clientTimeUsedMs'
    ]))
    or input->>'code' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{code}', to_jsonb(encode(sha256(convert_to(input->>'code', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_logic_code_attempt' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'logic-code' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  code_length := (question.public_payload->>'codeLength')::integer;
  normalized_code := btrim(input->>'code');
  normalized_solution := solution.solution_payload->>'correctAnswer';
  if code_length not between 1 and 12
    or char_length(normalized_code) <> code_length
    or normalized_code !~ '^[0-9]+$'
    or char_length(normalized_solution) <> code_length
    or normalized_solution !~ '^[0-9]+$' then
    raise exception 'invalid_logic_code' using errcode = '22023';
  end if;
  if exists (select 1 from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.code = normalized_code) then
    raise exception 'duplicate_logic_code' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  solved := normalized_code = normalized_solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.logic_code_attempt_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, code, correct,
    penalty_applied, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized_code, solved,
    not solved, instant, presented, used_ms, key)
  returning * into event;
  if not solved then
    incorrect_attempts := sequence_no;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', false, 'terminal', false,
      'incorrectAttempts', incorrect_attempts);
  else
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    incorrect_attempts := (select count(*)::integer from private.logic_code_attempt_events e
      where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct);
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, to_jsonb(event.code), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', true, 'terminal', true,
      'incorrectAttempts', incorrect_attempts, 'receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_set(result, '{lockVersion}', to_jsonb(a.lock_version));
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_logic_code_attempt', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'sequence', event.sequence, 'terminal', solved));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_logic_code_attempt', safe_input, result);
  return result;
end;
$$;

alter function private.logic_code_progress(uuid, uuid) owner to postgres;
alter function private.submit_logic_code_attempt(jsonb) owner to postgres;
revoke all on function private.logic_code_progress(uuid, uuid), private.submit_logic_code_attempt(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.submit_logic_code_attempt(jsonb) to service_role;

alter table private.logic_code_attempt_events enable row level security;
revoke all on private.logic_code_attempt_events from public, anon, authenticated, service_role;
