create index command_requests_input_attempt_idx on private.command_requests ((input->>'attemptId'));
create index command_requests_result_attempt_idx on private.command_requests ((result->>'attemptId'));

create table private.attempt_start_preparations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  scheduled_challenge_id uuid not null references public.scheduled_challenges(id),
  expected_attempt_id uuid,
  token_hash text not null,
  expires_at timestamptz not null
);
create index attempt_start_preparations_pair_idx
  on private.attempt_start_preparations(player_id, scheduled_challenge_id);
alter table private.attempt_start_preparations enable row level security;
revoke all on private.attempt_start_preparations from public, anon, authenticated, service_role;

create function private.issue_attempt_start(
  publication_id uuid, expected_attempt_id uuid, fresh_token text, previous_token text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  existing_id uuid;
  use_previous boolean := false;
  preparation_id uuid;
begin
  perform private.prepare_attempt_session(publication_id);
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || publication_id, 0));

  select a.id into existing_id from public.attempts a
  where a.player_id = actor and a.scheduled_challenge_id = publication_id and a.kind = 'competitive';
  if expected_attempt_id is not null and existing_id is distinct from expected_attempt_id then
    raise exception 'attempt_session_missing' using errcode = '55000';
  end if;

  select exists (
    select 1 from private.attempt_sessions s where s.attempt_id = existing_id and s.revoked_at is null
      and s.session_token_hash = case when length(previous_token) >= 32 then private.secret_hash(previous_token) end
  ) into use_previous;
  delete from private.attempt_start_preparations p
  where p.player_id = actor and p.expires_at <= clock_timestamp();
  insert into private.attempt_start_preparations (
    player_id, scheduled_challenge_id, expected_attempt_id, token_hash, expires_at
  ) values (
    actor, publication_id, existing_id,
    private.secret_hash(case when use_previous then previous_token else fresh_token end),
    clock_timestamp() + interval '5 minutes'
  ) returning id into preparation_id;
  return jsonb_build_object('preparationId', preparation_id, 'usePreviousToken', use_previous);
end;
$$;
alter function private.issue_attempt_start(uuid, uuid, text, text) owner to postgres;
revoke all on function private.issue_attempt_start(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function private.issue_attempt_start(uuid, uuid, text, text) to service_role;

create function private.start_prepared_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  publication_id uuid := (input->>'scheduledChallengeId')::uuid;
  preparation private.attempt_start_preparations%rowtype;
begin
  perform private.prepare_attempt_session(publication_id);
  -- Keep the same lock order as execute_command -> handle_attempt_start.
  perform private.lock_command_key(actor, input->>'idempotencyKey');
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || publication_id, 0));
  select * into preparation from private.attempt_start_preparations p
  where p.id = (input->>'preparationId')::uuid and p.player_id = actor
    and p.scheduled_challenge_id = publication_id and p.expires_at > clock_timestamp()
    and p.token_hash = private.secret_hash(input->>'sessionToken');
  if not found or (preparation.expected_attempt_id is not null and not exists (
    select 1 from public.attempts a where a.id = preparation.expected_attempt_id
      and a.player_id = actor and a.scheduled_challenge_id = publication_id
  )) then
    raise exception 'attempt_session_missing' using errcode = '55000';
  end if;
  return private.start_attempt(input - 'preparationId');
end;
$$;
alter function private.start_prepared_attempt(jsonb) owner to postgres;
revoke all on function private.start_prepared_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.start_prepared_attempt(jsonb) to service_role;

create function private.purge_terminal_attempt(input jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  target_id uuid := (input->>'attemptId')::uuid;
  target_publication uuid := (input->>'scheduledChallengeId')::uuid;
  room_key text;
  target public.attempts%rowtype;
  previous_purge text;
begin
  if not exists (select 1 from private.platform_role_assignments p
    where p.player_id = actor and p.role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_id is null then raise exception 'invalid_command' using errcode = '22023'; end if;

  select r.slug into room_key
  from public.scheduled_challenges p
  join public.seasons s on s.id = p.season_id
  join public.rooms r on r.id = s.room_id
  where p.id = target_publication and r.id = (input->>'roomId')::uuid and r.status = 'active';
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into target from public.attempts a where a.id = target_id;
  if not found then return room_key; end if;
  if target.scheduled_challenge_id <> target_publication or target.kind <> 'competitive' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || target.player_id || ':' || target_publication, 0));
  select * into target from public.attempts a where a.id = target_id for update;
  if not found then return room_key; end if;
  if target.status not in ('completed', 'abandoned', 'invalidated') then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;

  previous_purge := current_setting('flash.purge_attempt_id', true);
  perform set_config('flash.purge_attempt_id', target_id::text, true);

  delete from private.attempt_start_preparations p
  where p.player_id = target.player_id and p.scheduled_challenge_id = target_publication;
  delete from private.room_measurement_ratings r
  where r.attempt_id = target_id or (r.attempt_id is null
    and r.player_id = target.player_id and r.publication_id = target_publication);
  delete from private.room_measurement_events e where e.type = 'review_viewed'
    and (e.attempt_id = target_id or (e.attempt_id is null
      and e.player_id = target.player_id and e.publication_id = target_publication));
  delete from private.command_requests c
  where c.input->>'attemptId' = target_id::text or c.result->>'attemptId' = target_id::text;
  delete from private.audit_log l where l.entity_type = 'attempt' and l.entity_id = target_id;

  delete from private.flash_point_entries e where e.attempt_id = target_id;
  delete from private.attempt_sessions s where s.attempt_id = target_id;
  delete from private.attempt_answers a where a.attempt_id = target_id;
  delete from private.answer_receipts r where r.attempt_id = target_id;
  delete from private.interaction_intervals i where i.attempt_id = target_id;
  delete from private.attempt_timing_units t where t.attempt_id = target_id;
  delete from private.prepared_interactions i where i.attempt_id = target_id;
  delete from private.progressive_clue_reveal_events e where e.attempt_id = target_id;
  delete from private.logic_code_attempt_events e where e.attempt_id = target_id;
  delete from private.mini_wordle_guess_events e where e.attempt_id = target_id;
  delete from private.queens_placement_events e where e.attempt_id = target_id;
  delete from private.queens_validation_events e where e.attempt_id = target_id;
  delete from private.word_search_selection_events e where e.attempt_id = target_id;
  delete from public.attempts a where a.id = target_id;

  perform set_config('flash.purge_attempt_id', coalesce(previous_purge, ''), true);
  return room_key;
end;
$$;
alter function private.purge_terminal_attempt(jsonb) owner to postgres;
revoke all on function private.purge_terminal_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.purge_terminal_attempt(jsonb) to service_role;
