SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.read_attempt_context (
  target_attempt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_competitive_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare challenge_mode text; challenge_rows jsonb;
begin
  select version.mode into challenge_mode
  from public.scheduled_challenges publication
  join public.seasons season on season.id = publication.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = publication.challenge_version_id
  where publication.id = target_publication_id and room.slug = target_room_slug;

  case challenge_mode
    when 'flash' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_flash_challenge(target_room_slug, target_publication_id) row;
    when 'alphabet' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_alphabet_challenge(target_room_slug, target_publication_id) row;
    when 'survival' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_survival_challenge(target_room_slug, target_publication_id) row;
    when 'pyramid' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_pyramid_challenge(target_room_slug, target_publication_id) row;
    when 'narrative' then
      select jsonb_agg(to_jsonb(row) order by row.item_position) into challenge_rows
      from public.get_my_narrative_challenge(target_room_slug, target_publication_id) row;
    else return null;
  end case;

  -- Never disclose even the mode for an absent/inaccessible projection.
  if challenge_rows is null then return null; end if;
  return jsonb_build_object('mode', challenge_mode, 'rows', challenge_rows);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."get_my_competitive_challenge"(text, uuid) FROM PUBLIC, "anon", "service_role";

REVOKE ALL ON FUNCTION "private"."read_attempt_context"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_attempt_context"(uuid, text) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_my_competitive_challenge"(text, uuid) TO "authenticated", "postgres";

-- Explicit ACLs also protect against grants inherited from API defaults.
REVOKE ALL ON FUNCTION private.read_attempt_context(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.read_attempt_context(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_my_competitive_challenge(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_competitive_challenge(text, uuid) TO authenticated;
