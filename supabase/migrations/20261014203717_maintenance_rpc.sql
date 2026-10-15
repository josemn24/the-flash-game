SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.expire_stale_attempts (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql VOLATILE SECURITY INVOKER
  SET search_path TO ''
  SET statement_timeout TO '5s'
  AS $function$
  select private.expire_stale_attempts(input);
$function$;

REVOKE ALL ON FUNCTION "public"."expire_stale_attempts"(jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.run_calendar_tick (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql VOLATILE SECURITY INVOKER
  SET search_path TO ''
  SET statement_timeout TO '0'
  SET lock_timeout TO '0'
  AS $function$
  select private.run_calendar_tick_command(input);
$function$;

REVOKE ALL ON FUNCTION "public"."run_calendar_tick"(jsonb) FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."expire_stale_attempts"(jsonb) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."run_calendar_tick"(jsonb) TO "postgres", "service_role";

ALTER FUNCTION public.expire_stale_attempts(jsonb) OWNER TO postgres;
ALTER FUNCTION public.run_calendar_tick(jsonb) OWNER TO postgres;
NOTIFY pgrst, 'reload schema';
