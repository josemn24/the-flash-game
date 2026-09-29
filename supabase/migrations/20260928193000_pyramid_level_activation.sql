set local check_function_bodies = off;

create table if not exists private.prepared_interactions (
  attempt_id uuid primary key,
  challenge_version_id uuid not null,
  challenge_item_id uuid not null,
  prepared_at timestamptz not null default clock_timestamp(),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id)
);
create index if not exists prepared_interactions_item_idx
  on private.prepared_interactions(challenge_item_id);
alter table private.prepared_interactions enable row level security;
revoke all on table private.prepared_interactions from public, anon, authenticated, service_role;

create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  mode text;
  key text := input->>'idempotencyKey';
  had_open boolean;
  segment private.interaction_intervals%rowtype;
  result jsonb;
begin
  select cv.mode into mode
  from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = (input->>'attemptId')::uuid;
  if mode <> 'pyramid' then
    return private.execute_command('prepare', input);
  end if;

  select exists (
    select 1 from private.interaction_intervals
    where attempt_id = (input->>'attemptId')::uuid and ended_at is null
  ) into had_open;
  result := private.execute_command('prepare', input);

  -- Compatibility for databases whose prepare handler started the clock.
  if result->>'deadlineAt' is not null and not had_open then
    select * into segment from private.interaction_intervals
    where attempt_id = (input->>'attemptId')::uuid and ended_at is null
    for update;
    if found then
      insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
      select segment.attempt_id, unit.challenge_version_id, segment.challenge_item_id
      from private.attempt_timing_units unit
      where unit.id = segment.timing_unit_id
      on conflict (attempt_id) do nothing;
      delete from private.interaction_intervals where id = segment.id;
      delete from private.attempt_timing_units where id = segment.timing_unit_id;
    else
      insert into private.prepared_interactions(attempt_id, challenge_version_id, challenge_item_id)
      select (input->>'attemptId')::uuid, a.challenge_version_id, (result->>'challengeItemId')::uuid
      from public.attempts a where a.id = (input->>'attemptId')::uuid
      on conflict (attempt_id) do nothing;
    end if;
    result := jsonb_set(result, '{presentedAt}', 'null'::jsonb, true);
    result := jsonb_set(result, '{deadlineAt}', 'null'::jsonb, true);
    result := jsonb_set(result, '{timedOut}', 'false'::jsonb, true);
    update private.command_requests
    set result = prepare_interaction.result
    where actor_id = actor and idempotency_key = key and operation = 'prepare';
  end if;
  return result;
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;

create function private.activate_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  sc public.scheduled_challenges%rowtype;
  cv private.challenge_versions%rowtype;
  session_row private.attempt_sessions%rowtype;
  prepared private.prepared_interactions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests
  where actor_id = actor and idempotency_key = key;
  if found then
    if cached.operation <> 'activate' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
  select * into cv from private.challenge_versions where id = a.challenge_version_id;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor)
    or not exists (
      select 1 from public.seasons s
      join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
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
  if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
  if sc.status = 'cancelled' then raise exception 'publication_cancelled' using errcode = '55000'; end if;

  select * into segment from private.interaction_intervals
  where attempt_id = a.id and ended_at is null for update;
  if found then
    if segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
      raise exception 'interaction_not_presented' using errcode = '55000';
    end if;
    select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  else
    select * into prepared from private.prepared_interactions
    where attempt_id = a.id and challenge_item_id = (input->>'challengeItemId')::uuid for update;
    if not found then raise exception 'interaction_not_presented' using errcode = '55000'; end if;
    select * into item from private.challenge_items where id = prepared.challenge_item_id;
    insert into private.attempt_timing_units(
      attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
    select a.id, a.challenge_version_id, item.id, 'level', instant,
      instant + q.time_limit_ms * interval '1 millisecond'
    from private.question_versions q where q.id = item.question_version_id
    returning * into unit;
    insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
      values(a.id, item.id, unit.id, instant) returning * into segment;
    delete from private.prepared_interactions where attempt_id = a.id;
  end if;

  update public.attempts
  set lock_version = lock_version + 1, last_activity_at = instant
  where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'lockVersion', a.lock_version,
    'challengeItemId', segment.challenge_item_id,
    'presentedAt', segment.started_at,
    'deadlineAt', unit.deadline_at,
    'timedOut', instant >= unit.deadline_at);
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
  values(actor, 'activate', 'attempt', a.id, key,
    jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'activate', safe_input, result);
  return result;
end;
$$;
alter function private.activate_interaction(jsonb) owner to postgres;
revoke all on function private.activate_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.activate_interaction(jsonb) to service_role;
