-- Attempt operations invoked only by the authorized coordinator.
set local check_function_bodies = off;

create function private.handle_attempt_start(
  input jsonb,
  safe_input jsonb,
  actor uuid,
  cached_result jsonb,
  is_admin boolean
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
declare
  a public.attempts%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  target uuid;
  season_id_value uuid;
  room_id_value uuid;
  result jsonb;
  resumed boolean := false;
  control_required boolean := false;
begin
  target := (input->>'scheduledChallengeId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
  if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
  select p.season_id,s.room_id into season_id_value,room_id_value from public.scheduled_challenges p join public.seasons s on s.id=p.season_id where p.id=target;
  if not found then raise exception 'not_authorized' using errcode='42501'; end if;
  perform 1 from public.rooms where id=room_id_value for share;
  perform 1 from public.seasons where id=season_id_value for share;
  select * into sc from public.scheduled_challenges where id = target for share;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
    join public.room_memberships m on m.room_id = r.id
    where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
      and m.status = 'active' and m.role in ('owner','admin','member')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
  if cached_result is not null then
    perform private.authorize_attempt_replay(a.id, safe_input->>'sessionToken');
    return jsonb_build_object(
      'result', cached_result,
      'entityType', 'attempt',
      'entityId', a.id,
      'beforePayload', null,
      'replayed', true
    ); end if;
  if found then
    if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
    resumed := true;
    select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
    control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
  else
    insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
    values(actor, target, sc.challenge_version_id, 'competitive', 1)
    returning * into a;
    insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
      values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
  end if;
  target := a.id;
  result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
    'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version,
    'timeTrial', case when (select mode from private.challenge_versions where id = a.challenge_version_id) = 'time-trial' then private.time_trial_progress(a.id) end);
  return jsonb_build_object('result', result, 'entityType', 'attempt', 'entityId', a.id, 'beforePayload', null, 'replayed', false);
end;
$$;
alter function private.handle_attempt_start(jsonb, jsonb, uuid, jsonb, boolean) owner to postgres;
revoke all on function private.handle_attempt_start(jsonb, jsonb, uuid, jsonb, boolean) from public, anon, authenticated, service_role;
