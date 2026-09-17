-- E03: progressive-clues event storage, reveal RPC and recovery/read boundaries.
-- The migration is deliberately incremental: existing command functions are
-- retained as private base implementations and wrapped with the E03 boundary.

set local check_function_bodies = off;

create table if not exists private.progressive_clue_reveal_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  clue_index integer not null check (clue_index > 0),
  penalty_points integer not null check (penalty_points >= 0),
  available_points integer not null check (available_points >= 0),
  revealed_at timestamptz not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id, clue_index),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id)
);

create index if not exists progressive_clue_events_item_idx
  on private.progressive_clue_reveal_events(attempt_id, challenge_item_id, clue_index);

create or replace function private.progressive_clue_effective_penalty(
  configured_penalty integer,
  item_points integer
) returns integer
language sql immutable set search_path = '' as $$
  select case
    when configured_penalty <= 0 or item_points <= 0 then 0
    else greatest(1, round((configured_penalty::numeric / 50) * item_points)::integer)
  end
$$;

create or replace function private.progressive_clues_public_payload(target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'clueCount', jsonb_array_length(q.public_payload->'clues'),
    'cluePenalty', q.public_payload->'cluePenalty'
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'progressive-clues'
$$;

create or replace function private.progressive_clues_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with content as (
    select
      i.points,
      q.public_payload,
      jsonb_array_length(q.public_payload->'clues') as total_clues,
      private.progressive_clue_effective_penalty(
        (q.public_payload->>'cluePenalty')::integer,
        i.points
      ) as effective_penalty
    from private.challenge_items i
    join private.question_versions q on q.id = i.question_version_id
    where i.id = target_item and q.type = 'progressive-clues'
  ), current_progress as (
    select
      coalesce(max(e.clue_index), 0)::integer as revealed_clues,
      coalesce((array_agg(e.available_points order by e.clue_index desc))[1], c.points)::integer
        as available_points
    from content c
    left join private.progressive_clue_reveal_events e
      on e.attempt_id = target_attempt and e.challenge_item_id = target_item
    group by c.points
  )
  select jsonb_build_object(
    'kind', 'progressive-clues',
    'clues', coalesce((
      select jsonb_agg(value order by ordinality)
      from jsonb_array_elements_text(c.public_payload->'clues') with ordinality
      where ordinality <= p.revealed_clues
    ), '[]'::jsonb),
    'revealedClues', p.revealed_clues,
    'totalClues', c.total_clues,
    'availablePoints', p.available_points,
    'cluePenalty', c.effective_penalty
  )
  from content c cross join current_progress p
$$;

create or replace function private.ensure_progressive_clue_initial(
  target_attempt uuid,
  target_item uuid,
  target_version uuid
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
begin
  select * into item
  from private.challenge_items
  where id = target_item and challenge_version_id = target_version;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' then return; end if;
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values(
    target_attempt, target_item, target_version, 1, 0, item.points, instant,
    'prepare-progressive-clue:' || target_attempt || ':' || target_item
  ) on conflict (attempt_id, challenge_item_id, clue_index) do nothing;
end;
$$;

create or replace function private.reveal_progressive_clue(input jsonb) returns jsonb
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
  event private.progressive_clue_reveal_events%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  total_clues integer;
  next_index integer;
  effective_penalty integer;
  available_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'reveal_progressive_clue' or cached.input <> safe_input) then
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
  if question.type <> 'progressive-clues' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
  total_clues := jsonb_array_length(question.public_payload->'clues');
  select coalesce(max(e.clue_index), 0) + 1 into next_index
    from private.progressive_clue_reveal_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  if next_index > total_clues then
    raise exception 'all_clues_revealed' using errcode = '55000';
  end if;
  effective_penalty := private.progressive_clue_effective_penalty(
    (question.public_payload->>'cluePenalty')::integer, item.points);
  available_points := greatest(0, item.points - effective_penalty * (next_index - 1));
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values(a.id, item.id, a.challenge_version_id, next_index,
    effective_penalty, available_points, instant, key) returning * into event;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'clueIndex', event.clue_index, 'clue', question.public_payload->'clues'->>(event.clue_index - 1),
    'revealedClues', event.clue_index, 'totalClues', total_clues,
    'availablePoints', event.available_points, 'cluePenalty', event.penalty_points);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'reveal_progressive_clue', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'clueIndex', event.clue_index,
        'availablePoints', event.available_points));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'reveal_progressive_clue', safe_input, result);
  return result;
end;
$$;

alter function private.progressive_clue_effective_penalty(integer, integer) owner to postgres;
alter function private.progressive_clues_public_payload(uuid) owner to postgres;
alter function private.progressive_clues_progress(uuid, uuid) owner to postgres;
alter function private.ensure_progressive_clue_initial(uuid, uuid, uuid) owner to postgres;
alter function private.reveal_progressive_clue(jsonb) owner to postgres;
revoke all on table private.progressive_clue_reveal_events from public, anon, authenticated, service_role;
revoke all on function private.progressive_clue_effective_penalty(integer, integer),
  private.progressive_clues_public_payload(uuid), private.progressive_clues_progress(uuid, uuid),
  private.ensure_progressive_clue_initial(uuid, uuid, uuid), private.reveal_progressive_clue(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.reveal_progressive_clue(jsonb) to service_role;
alter table private.progressive_clue_reveal_events enable row level security;

alter function private.execute_command(text, jsonb) rename to execute_command_base;

create function private.execute_command(op text, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  item_id uuid;
  attempt_id uuid;
begin
  result := private.execute_command_base(op, input);
  if op <> 'prepare' or result->>'questionType' <> 'progressive-clues'
    or coalesce((result->>'timedOut')::boolean, false) then
    return result;
  end if;
  item_id := (result->>'challengeItemId')::uuid;
  attempt_id := (result->>'attemptId')::uuid;
  perform private.ensure_progressive_clue_initial(
    attempt_id, item_id,
    (select challenge_version_id from public.attempts where id = attempt_id));
  return jsonb_set(
    jsonb_set(result, '{publicPayload}', private.progressive_clues_public_payload(item_id)),
    '{progress}', private.progressive_clues_progress(attempt_id, item_id));
end;
$$;
alter function private.execute_command(text, jsonb) owner to postgres;
revoke all on function private.execute_command(text, jsonb), private.execute_command_base(text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from private.command_requests
    where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey'
      and operation = 'prepare'
  ) then
    return private.execute_command('prepare', input);
  end if;
  if exists (
    select 1 from private.interaction_intervals x
    join public.attempts a on a.id = x.attempt_id
    join private.challenge_versions cv on cv.id = a.challenge_version_id
    join private.challenge_items ci on ci.id = x.challenge_item_id
    join private.question_versions q on q.id = ci.question_version_id
    where x.attempt_id = (input->>'attemptId')::uuid and x.ended_at is null and cv.mode = 'flash'
      and q.type not in ('mini-wordle', 'logic-code', 'progressive-clues')
  ) then
    raise exception 'recovery_required' using errcode = '55000';
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;

alter function private.read_evaluation_context(uuid, text) rename to read_evaluation_context_base;

create function private.read_evaluation_context(target_receipt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  question_type text;
  revealed integer;
begin
  result := private.read_evaluation_context_base(target_receipt, session_token);
  select q.type, coalesce(max(e.clue_index), 1)::integer
    into question_type, revealed
    from private.answer_receipts r
    join private.challenge_items i on i.id = r.challenge_item_id
    join private.question_versions q on q.id = i.question_version_id
    left join private.progressive_clue_reveal_events e
      on e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    where r.id = target_receipt
    group by q.type;
  return result || jsonb_build_object(
    'progressiveCluesRevealed', case when question_type = 'progressive-clues' then revealed else null end);
end;
$$;
alter function private.read_evaluation_context(uuid, text) owner to postgres;
revoke all on function private.read_evaluation_context(uuid, text), private.read_evaluation_context_base(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.read_evaluation_context(uuid, text) to service_role;

alter function private.recover_attempt(jsonb) rename to recover_attempt_base;

create function private.recover_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      if question.type in ('mini-wordle', 'logic-code', 'progressive-clues') and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id, null, instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$$;
alter function private.recover_attempt(jsonb) owner to postgres;
revoke all on function private.recover_attempt(jsonb), private.recover_attempt_base(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.recover_attempt(jsonb) to service_role;
