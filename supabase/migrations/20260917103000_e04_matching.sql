-- E04: private matching events, safe progress projections and pair command.

set local check_function_bodies = off;

create table private.matching_pair_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  left_item_id text not null check (btrim(left_item_id) <> '' and char_length(left_item_id) <= 120),
  right_item_id text not null check (btrim(right_item_id) <> '' and char_length(right_item_id) <= 120),
  correct boolean not null,
  penalty_points integer not null check (penalty_points >= 0),
  received_at timestamptz not null,
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id) references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id) references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, challenge_item_id, left_item_id, right_item_id),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (received_at >= presented_at)
);
create index matching_pair_events_item_idx on private.matching_pair_events(attempt_id, challenge_item_id, sequence);
create index matching_pair_events_left_idx on private.matching_pair_events(attempt_id, challenge_item_id, left_item_id);
create index matching_pair_events_right_idx on private.matching_pair_events(attempt_id, challenge_item_id, right_item_id);
create unique index matching_pair_events_correct_left_idx on private.matching_pair_events(attempt_id, challenge_item_id, left_item_id) where correct;
create unique index matching_pair_events_correct_right_idx on private.matching_pair_events(attempt_id, challenge_item_id, right_item_id) where correct;

create function private.matching_public_payload(target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'leftItems', coalesce((select jsonb_agg(value - 'correctMatchId' order by ordinality) from jsonb_array_elements(q.public_payload->'leftItems') with ordinality), '[]'::jsonb),
    'rightItems', coalesce((select jsonb_agg(value - 'correctMatchId' order by ordinality) from jsonb_array_elements(q.public_payload->'rightItems') with ordinality), '[]'::jsonb)
  )
  from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'matching'
$$;

create function private.matching_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kind', 'matching',
    'matchedPairs', coalesce(jsonb_agg(jsonb_build_object('leftId', e.left_item_id, 'rightId', e.right_item_id) order by e.sequence) filter (where e.correct), '[]'::jsonb),
    'matchedCount', count(*) filter (where e.correct)::integer,
    'totalPairs', jsonb_array_length(q.public_payload->'leftItems'),
    'incorrectAttempts', count(*) filter (where not e.correct)::integer,
    'penaltyPoints', coalesce(sum(e.penalty_points) filter (where not e.correct), 0)::integer
  )
  from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
  left join private.matching_pair_events e on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'matching'
  group by q.public_payload
$$;

create function private.submit_matching_pair(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey'; safe_input jsonb := input;
  cached private.command_requests%rowtype; a public.attempts%rowtype; session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype; item private.challenge_items%rowtype;
  question private.question_versions%rowtype; solution private.question_version_solutions%rowtype;
  event private.matching_pair_events%rowtype; receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp(); presented timestamptz; effective timestamptz; used_ms bigint;
  expected bigint; sequence_no integer; total_pairs integer; penalty integer; solved boolean; terminal boolean;
  progress jsonb; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','leftItemId','rightItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','leftItemId','rightItemId','clientTimeUsedMs']))
    or input->>'leftItemId' is null or btrim(input->>'leftItemId') = ''
    or input->>'rightItemId' is null or btrim(input->>'rightItemId') = '' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_matching_pair' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into session_row from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then raise exception 'interaction_not_presented' using errcode = '55000'; end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'matching' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'leftItems') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'rightItems') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'matches') is distinct from 'object' then raise exception 'unsupported_question' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') value where value->>'id' = btrim(input->>'leftItemId'))
    or not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') value where value->>'id' = btrim(input->>'rightItemId')) then raise exception 'invalid_matching_pair' using errcode = '22023'; end if;
  if exists (select 1 from private.matching_pair_events e where e.attempt_id = a.id and e.challenge_item_id = item.id and e.left_item_id = btrim(input->>'leftItemId') and e.right_item_id = btrim(input->>'rightItemId')) then raise exception 'duplicate_matching_pair' using errcode = '55000'; end if;
  if exists (select 1 from private.matching_pair_events e where e.attempt_id = a.id and e.challenge_item_id = item.id and e.correct and (e.left_item_id = btrim(input->>'leftItemId') or e.right_item_id = btrim(input->>'rightItemId'))) then raise exception 'matching_item_already_resolved' using errcode = '55000'; end if;
  total_pairs := jsonb_array_length(question.public_payload->'leftItems');
  solved := solution.solution_payload->'matches'->>btrim(input->>'leftItemId') = btrim(input->>'rightItemId');
  penalty := case when solved then 0 else round(item.points * 0.10::numeric)::integer end;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no from private.matching_pair_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint into presented, used_ms
    from private.interaction_intervals where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.matching_pair_events(attempt_id, challenge_item_id, challenge_version_id, sequence, left_item_id, right_item_id, correct, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
    values(a.id, item.id, a.challenge_version_id, sequence_no, btrim(input->>'leftItemId'), btrim(input->>'rightItemId'), solved, penalty, instant, presented, used_ms, key) returning * into event;
  progress := private.matching_progress(a.id, item.id);
  terminal := solved and (progress->>'matchedCount')::integer = total_pairs;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
      values(a.id, item.id, a.challenge_version_id, coalesce((select jsonb_object_agg(e.left_item_id, e.right_item_id) from private.matching_pair_events e where e.attempt_id = a.id and e.challenge_item_id = item.id and e.correct), '{}'::jsonb), instant, presented, effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := jsonb_build_object('attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version, 'leftItemId', event.left_item_id, 'rightItemId', event.right_item_id, 'correct', event.correct, 'terminal', terminal, 'matchedPairs', progress->'matchedPairs', 'matchedCount', progress->'matchedCount', 'totalPairs', progress->'totalPairs', 'incorrectAttempts', progress->'incorrectAttempts', 'penaltyPoints', progress->'penaltyPoints');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload) values(actor, 'submit_matching_pair', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), jsonb_build_object('lockVersion', a.lock_version, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result) values(actor, key, 'submit_matching_pair', safe_input, result);
  return result;
end;
$$;

alter function private.matching_public_payload(uuid) owner to postgres;
alter function private.matching_progress(uuid, uuid) owner to postgres;
alter function private.submit_matching_pair(jsonb) owner to postgres;
alter table private.matching_pair_events enable row level security;
revoke all on private.matching_pair_events from public, anon, authenticated, service_role;
revoke all on function private.matching_public_payload(uuid), private.matching_progress(uuid, uuid), private.submit_matching_pair(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.submit_matching_pair(jsonb) to service_role;

-- Extend the E03 safe prepare wrapper without renaming its base a second time.
create or replace function private.execute_command(op text, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; item_id uuid; attempt_id uuid; question_type text;
begin
  if op = 'receive' and jsonb_typeof(input->'answer') <> 'null'
    and exists (
      select 1 from private.challenge_items i
      join private.question_versions q on q.id = i.question_version_id
      where i.id = (input->>'challengeItemId')::uuid and q.type = 'matching'
    ) then
    raise exception 'matching_requires_pair_command' using errcode = '22023';
  end if;
  result := private.execute_command_base(op, input);
  question_type := result->>'questionType';
  if op <> 'prepare' or coalesce((result->>'timedOut')::boolean, false)
    or question_type not in ('progressive-clues', 'matching') then return result; end if;
  item_id := (result->>'challengeItemId')::uuid; attempt_id := (result->>'attemptId')::uuid;
  if question_type = 'progressive-clues' then
    perform private.ensure_progressive_clue_initial(attempt_id, item_id, (select challenge_version_id from public.attempts where id = attempt_id));
    return jsonb_set(jsonb_set(result, '{publicPayload}', private.progressive_clues_public_payload(item_id)), '{progress}', private.progressive_clues_progress(attempt_id, item_id));
  end if;
  return jsonb_set(jsonb_set(result, '{publicPayload}', private.matching_public_payload(item_id)), '{progress}', private.matching_progress(attempt_id, item_id));
end;
$$;
alter function private.execute_command(text, jsonb) owner to postgres;
revoke all on function private.execute_command(text, jsonb) from public, anon, authenticated, service_role;

create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.command_requests where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey' and operation = 'prepare') then
    return private.execute_command('prepare', input);
  end if;
  if exists (select 1 from private.interaction_intervals x join public.attempts a on a.id = x.attempt_id join private.challenge_versions cv on cv.id = a.challenge_version_id join private.challenge_items ci on ci.id = x.challenge_item_id join private.question_versions q on q.id = ci.question_version_id where x.attempt_id = (input->>'attemptId')::uuid and x.ended_at is null and cv.mode = 'flash' and q.type not in ('mini-wordle', 'logic-code', 'progressive-clues', 'matching')) then
    raise exception 'recovery_required' using errcode = '55000';
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;

create or replace function private.read_evaluation_context(target_receipt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; question_type text; revealed integer; matching_incorrect integer;
begin
  result := private.read_evaluation_context_base(target_receipt, session_token);
  select q.type, coalesce(max(c.clue_index), 1)::integer, coalesce(count(m.id) filter (where not m.correct), 0)::integer
    into question_type, revealed, matching_incorrect
    from private.answer_receipts r join private.challenge_items i on i.id = r.challenge_item_id join private.question_versions q on q.id = i.question_version_id
    left join private.progressive_clue_reveal_events c on c.attempt_id = r.attempt_id and c.challenge_item_id = r.challenge_item_id
    left join private.matching_pair_events m on m.attempt_id = r.attempt_id and m.challenge_item_id = r.challenge_item_id
    where r.id = target_receipt group by q.type;
  if question_type = 'matching' then
    result := jsonb_set(result, '{answer}', coalesce((select jsonb_object_agg(m.left_item_id, m.right_item_id) from private.answer_receipts r join private.matching_pair_events m on m.attempt_id = r.attempt_id and m.challenge_item_id = r.challenge_item_id and m.correct where r.id = target_receipt), '{}'::jsonb));
  end if;
  return result || jsonb_build_object('progressiveCluesRevealed', case when question_type = 'progressive-clues' then revealed else null end, 'matchingIncorrectAttempts', case when question_type = 'matching' then matching_incorrect else null end);
end;
$$;
alter function private.read_evaluation_context(uuid, text) owner to postgres;
revoke all on function private.read_evaluation_context(uuid, text), private.read_evaluation_context_base(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.read_evaluation_context(uuid, text) to service_role;

create or replace function private.recover_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey'; safe_input jsonb := input;
  cached private.command_requests%rowtype; a public.attempts%rowtype; session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype; question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp(); expected bigint; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into session_row from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select q.* into question from private.interaction_intervals x join private.challenge_items i on i.id = x.challenge_item_id join private.question_versions q on q.id = i.question_version_id
    where x.attempt_id = a.id and x.ended_at is null;
  if question.type in ('mini-wordle', 'logic-code', 'progressive-clues', 'matching') then
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
    if instant < unit.deadline_at then
      update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
      result := jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version, 'receiptId', null, 'recovered', false, 'preserved', true);
      insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
        values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
      insert into private.command_requests(actor_id, idempotency_key, operation, input, result) values(actor, key, 'recover', safe_input, result);
      return result;
    end if;
  end if;
  return private.recover_attempt_base(input);
end;
$$;
alter function private.recover_attempt(jsonb) owner to postgres;
revoke all on function private.recover_attempt(jsonb), private.recover_attempt_base(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.recover_attempt(jsonb) to service_role;
