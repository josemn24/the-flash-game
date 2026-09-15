-- S04 Flash: an open prepared interaction is consumed on recovery, never replayed.
alter table private.interaction_intervals drop constraint interaction_intervals_end_reason_check;
alter table private.interaction_intervals add constraint interaction_intervals_end_reason_check
  check (end_reason = any (array['answer','pass','timeout','abandon','recovery_interrupted']));

create or replace function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.interaction_intervals where attempt_id = (input->>'attemptId')::uuid and ended_at is null) then
    raise exception 'recovery_required' using errcode = '55000';
  end if;
  return private.execute_command('prepare', input);
end;
$$;

create function private.recover_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); key text := input->>'idempotencyKey'; safe_input jsonb := input;
  cached private.command_requests%rowtype; a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp(); expected bigint;
  presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
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
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists
    (select 1 from private.attempt_answers aa where aa.receipt_id = r.id) order by r.received_at limit 1 for update;
  if found then result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      effective := greatest(segment.started_at, least(instant, unit.deadline_at));
      update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
      select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint into presented, used_ms
        from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
      insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at, presented_at,
        effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
      values(a.id, segment.challenge_item_id, a.challenge_version_id, null, instant, presented, effective, used_ms, instant >= unit.deadline_at, null)
      returning * into receipt;
      result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
    else result := jsonb_build_object('receiptId', null, 'recovered', false); end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result) values(actor, key, 'recover', safe_input, result);
  return result;
end;
$$;

create function private.read_attempt_recovery(target_attempt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object('attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status,
    'lockVersion', a.lock_version, 'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id and not exists
      (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id, 'status', aa.status,
      'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms) order by i.position) from private.attempt_answers aa
      join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive' and s.revoked_at is null
    and s.session_token_hash = private.secret_hash(session_token) and not exists
      (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$$;

alter function private.prepare_interaction(jsonb) owner to postgres;
alter function private.recover_attempt(jsonb) owner to postgres;
alter function private.read_attempt_recovery(uuid, text) owner to postgres;
revoke all on function private.prepare_interaction(jsonb), private.recover_attempt(jsonb), private.read_attempt_recovery(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb), private.recover_attempt(jsonb), private.read_attempt_recovery(uuid, text) to service_role;

drop function public.get_my_flash_challenge(text, uuid);
create function public.get_my_flash_challenge(target_room_slug text, target_publication_id uuid)
returns table (room_id uuid, room_slug text, room_title text, publication_id uuid, publication_status text,
  publication_opens_at timestamptz, publication_closes_at timestamptz, challenge_id uuid, challenge_slug text,
  challenge_version_id uuid, challenge_title text, challenge_subtitle text, challenge_description text, challenge_mode text,
  challenge_max_score integer, question_count bigint, own_attempt_id uuid, own_attempt_status text, own_attempt_score integer,
  own_attempt_started_at timestamptz, own_attempt_completed_at timestamptz, own_attempt_deadline_at timestamptz,
  own_attempt_lock_version bigint, challenge_item_id uuid, item_position integer, question_version_id uuid, question_type text,
  payload_schema_version integer, time_limit_ms integer, item_points integer)
language sql stable security definer set search_path = '' as $$
  with viewer as (select private.current_player_id() as player_id), p as (
    select r.id room_id, r.slug room_slug, r.title room_title, sc.id publication_id, sc.status publication_status,
      sc.opens_at publication_opens_at, sc.closes_at publication_closes_at, cd.id challenge_id, cd.slug challenge_slug,
      cv.id challenge_version_id, cv.title challenge_title, cv.subtitle challenge_subtitle, cv.description challenge_description,
      cv.mode challenge_mode, cv.max_score challenge_max_score, a.id own_attempt_id, a.status own_attempt_status,
      a.score own_attempt_score, a.started_at own_attempt_started_at, a.completed_at own_attempt_completed_at,
      a.deadline_at own_attempt_deadline_at, a.lock_version own_attempt_lock_version
    from public.rooms r join public.room_memberships m on m.room_id=r.id join public.seasons s on s.room_id=r.id and s.status='active'
      join public.scheduled_challenges sc on sc.season_id=s.id join private.challenge_versions cv on cv.id=sc.challenge_version_id
      join private.challenge_definitions cd on cd.id=cv.challenge_definition_id cross join viewer
      left join public.attempts a on a.scheduled_challenge_id=sc.id and a.player_id=viewer.player_id and a.kind='competitive'
    where r.slug=target_room_slug and sc.id=target_publication_id and r.status='active' and m.player_id=viewer.player_id
      and m.status='active' and m.role in ('owner','admin','member') and ((sc.status='open' and sc.opens_at<=statement_timestamp()
      and statement_timestamp()<sc.closes_at) or a.id is not null) and cv.status='published' and cv.mode='flash')
  select p.room_id,p.room_slug,p.room_title,p.publication_id,p.publication_status,p.publication_opens_at,p.publication_closes_at,
    p.challenge_id,p.challenge_slug,p.challenge_version_id,p.challenge_title,p.challenge_subtitle,p.challenge_description,p.challenge_mode,
    p.challenge_max_score,count(i.id) over(partition by p.challenge_version_id),p.own_attempt_id,p.own_attempt_status,p.own_attempt_score,
    p.own_attempt_started_at,p.own_attempt_completed_at,p.own_attempt_deadline_at,p.own_attempt_lock_version,i.id,i.position,q.id,q.type,
    q.payload_schema_version,q.time_limit_ms,i.points from p join private.challenge_items i on i.challenge_version_id=p.challenge_version_id
    join private.question_versions q on q.id=i.question_version_id order by i.position
$$;
alter function public.get_my_flash_challenge(text, uuid) owner to postgres;
revoke all on function public.get_my_flash_challenge(text, uuid) from public, anon, service_role;
grant execute on function public.get_my_flash_challenge(text, uuid) to authenticated;
