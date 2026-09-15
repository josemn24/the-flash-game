SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.provision_player()
  RETURNS TABLE (
    player_id    uuid,
    display_name text,
    avatar_path  text,
    status       text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  auth_user uuid := (select auth.uid());
  initial_name text := btrim(coalesce((select auth.jwt()) -> 'user_metadata' ->> 'display_name', ''));
begin
  if auth_user is null
    or coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'false' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if initial_name = '' or char_length(initial_name) not between 2 and 24 then
    initial_name := 'Jugador';
  end if;

  insert into public.players (auth_user_id, display_name)
  values (auth_user, initial_name)
  on conflict (auth_user_id) do nothing;

  select p.id, p.display_name, p.avatar_path, p.status
    into player_id, display_name, avatar_path, status
  from public.players p
  where p.auth_user_id = auth_user and p.status = 'active';

  if not found then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return next;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."provision_player"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."provision_player"() TO "authenticated", "postgres";
