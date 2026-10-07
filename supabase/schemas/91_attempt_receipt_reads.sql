-- Server-only reads: no playable payloads, secrets or solutions.
create function private.prepare_attempt_session(target_publication uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.scheduled_challenges sc
    join public.seasons season on season.id = sc.season_id
    join public.rooms room on room.id = season.room_id
    join public.room_memberships m on m.room_id = room.id
    where sc.id = target_publication and room.status = 'active'
      and m.player_id = private.current_player_id() and m.status = 'active'
      and m.role in ('owner','admin','member')
      and not exists (select 1 from private.platform_role_assignments where player_id = m.player_id)
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
end;
$$;

create function private.read_recorded_evaluation(target_receipt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target_attempt uuid; result jsonb;
begin
  select r.attempt_id into target_attempt from private.answer_receipts r where r.id = target_receipt;
  if target_attempt is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform private.authorize_attempt_replay(target_attempt, private.secret_hash(session_token));
  select jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
    'receiptId', answer.receipt_id, 'status', answer.status, 'points', answer.points,
    'details', answer.result_details)) into result
  from private.attempt_answers answer join public.attempts a on a.id = answer.attempt_id
  where answer.receipt_id = target_receipt;
  return result;
end;
$$;

-- A completed result remains readable after its controller is revoked and cookie cleared.
-- Membership/ownership are still required; review and Storage are deliberately separate.
create function private.read_completed_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('scheduledChallengeId', sc.id, 'result',
    jsonb_strip_nulls(jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version,
      'status', a.status, 'score', a.score, 'outcome', a.outcome,
      'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer end,
      'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case when answer.status in ('incorrect','unanswered','timeout') then 1
          when q.type = 'queens' and coalesce((answer.result_details->>'incorrectAttempts')::integer,0) > 0 then 1 else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions q on q.id = item.question_version_id where answer.attempt_id = a.id
      ),0),0) end,
      'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', answer.challenge_item_id,
        'answer', answer.answer, 'status', answer.status, 'points', answer.points,
        'timeUsedMs', answer.time_used_ms, 'resultDetails', answer.result_details) order by item.position)
        from private.attempt_answers answer join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id), '[]'::jsonb))))
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled'
    and room.status = 'active' and m.status = 'active' and m.role in ('owner','admin','member')
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;

alter function private.prepare_attempt_session(uuid) owner to postgres;
alter function private.read_recorded_evaluation(uuid, text) owner to postgres;
alter function private.read_completed_attempt(uuid) owner to postgres;
revoke all on function private.prepare_attempt_session(uuid), private.read_recorded_evaluation(uuid, text),
  private.read_completed_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function private.prepare_attempt_session(uuid), private.read_recorded_evaluation(uuid, text),
  private.read_completed_attempt(uuid) to service_role;

-- A lost abandonment confirmation must also be recoverable after controller revocation.
-- Permission-revoked closures have no abandon command to replay, so build the
-- same safe terminal projection from persisted attempt facts.
create function private.read_abandoned_attempt(target_attempt uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'scheduledChallengeId', a.scheduled_challenge_id,
    'result', coalesce(command.result, jsonb_strip_nulls(jsonb_build_object(
      'attemptId', a.id,
      'lockVersion', a.lock_version,
      'status', a.status,
      'score', a.score,
      'outcome', a.outcome,
      'terminalReason', a.terminal_reason,
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'challengeItemId', answer.challenge_item_id,
          'answer', answer.answer,
          'status', answer.status,
          'points', answer.points,
          'timeUsedMs', answer.time_used_ms,
          'resultDetails', answer.result_details
        ) order by item.position)
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        where answer.attempt_id = a.id
      ), '[]'::jsonb)
    )))
  )
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  left join public.room_memberships m on m.room_id = room.id and m.player_id = a.player_id
  left join private.command_requests command on command.actor_id = a.player_id
    and command.operation = 'abandon' and command.input->>'attemptId' = a.id::text
  where a.id = target_attempt and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'abandoned'
    and sc.status <> 'cancelled' and room.status = 'active'
    and (
      (a.terminal_reason = 'permission_revoked')
      or (
        command.result->>'status' = 'abandoned'
        and m.status = 'active' and m.role in ('owner','admin','member')
      )
    )
    and not exists (select 1 from private.platform_role_assignments where player_id = a.player_id)
$$;
alter function private.read_abandoned_attempt(uuid) owner to postgres;
revoke all on function private.read_abandoned_attempt(uuid) from public, anon, authenticated, service_role;
grant execute on function private.read_abandoned_attempt(uuid) to service_role;
