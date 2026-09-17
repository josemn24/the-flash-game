-- E03 — Authoritative progressive-clues reveal command.

create function private.reveal_progressive_clue(input jsonb) returns jsonb
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
    (question.public_payload->>'cluePenalty')::integer,
    item.points
  );
  available_points := greatest(0, item.points - effective_penalty * (next_index - 1));
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, next_index,
    effective_penalty, available_points, instant, key
  ) returning * into event;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'challengeItemId', item.id,
    'lockVersion', a.lock_version,
    'clueIndex', event.clue_index,
    'clue', question.public_payload->'clues'->>(event.clue_index - 1),
    'revealedClues', event.clue_index,
    'totalClues', total_clues,
    'availablePoints', event.available_points,
    'cluePenalty', event.penalty_points
  );
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

alter function private.reveal_progressive_clue(jsonb) owner to postgres;
revoke all on function private.reveal_progressive_clue(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.reveal_progressive_clue(jsonb) to service_role;
