-- Minimal context for guards and finish metadata; recovery alone aggregates answers.
create function private.read_attempt_context(target_attempt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object('challengeMode', version.mode, 'scheduledChallengeId', attempt.scheduled_challenge_id)
  into result
  from public.attempts attempt
  join private.attempt_sessions session on session.attempt_id = attempt.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  where attempt.id = target_attempt and attempt.player_id = actor and attempt.kind = 'competitive'
    and session.revoked_at is null and session.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$$;
alter function private.read_attempt_context(uuid, text) owner to postgres;
revoke all on function private.read_attempt_context(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.read_attempt_context(uuid, text) to service_role;
