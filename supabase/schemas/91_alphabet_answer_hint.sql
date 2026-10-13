-- Server-only input for Alphabet's visual reference. Never serialize this source.
create function private.read_alphabet_answer_hint_source(
  target_attempt uuid, target_item uuid, session_token text
) returns text
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result text;
begin
  perform private.raise_if_session_transferred(target_attempt, private.secret_hash(session_token));
  select solution.solution_payload->>'correctAnswer' into result
  from public.attempts attempt
  join private.attempt_sessions session on session.attempt_id = attempt.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_items item on item.challenge_version_id = version.id and item.id = target_item
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  join public.scheduled_challenges publication on publication.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = publication.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id and membership.player_id = actor
  where attempt.id = target_attempt and attempt.player_id = actor
    and attempt.kind = 'competitive' and attempt.status = 'in_progress'
    and version.mode = 'alphabet' and question.type = 'short-text'
    and session.revoked_at is null and session.session_token_hash = private.secret_hash(session_token)
    and room.status = 'active' and publication.status <> 'cancelled'
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
    and exists (select 1 from private.interaction_intervals presented
      where presented.attempt_id = attempt.id and presented.challenge_item_id = item.id)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$$;
alter function private.read_alphabet_answer_hint_source(uuid, uuid, text) owner to postgres;
revoke all on function private.read_alphabet_answer_hint_source(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.read_alphabet_answer_hint_source(uuid, uuid, text) to service_role;
