-- Internal command helpers; no direct execution by API roles.
set local check_function_bodies = off;

create function private.handle_attempt_admin_command(
  op text,
  input jsonb,
  actor uuid,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  instant timestamptz,
  key text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  balance integer;
  points integer;
  result jsonb;
begin
        if nullif(btrim(input->>'reason'), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
        if a.kind <> 'competitive' then raise exception 'not_competitive' using errcode = '55000'; end if;
        select coalesce(sum(amount),0)::integer into balance from private.flash_point_entries where attempt_id = a.id;
        if op = 'invalidate' then
          if a.status not in ('completed','abandoned') then raise exception 'attempt_not_terminal' using errcode = '55000'; end if;
          update public.attempts set status = 'invalidated', terminal_reason = input->>'reason', lock_version = lock_version + 1
            where id = a.id returning * into a;
          update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
          if exists (select 1 from private.flash_point_entries where attempt_id = a.id and entry_type = 'accreditation') then
            insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
              amount, reason, created_by_player_id, idempotency_key)
            values(sc.season_id, a.player_id, sc.id, a.id, 'reversal', -balance, input->>'reason', actor, 'invalidate:' || a.id);
          end if;
          result := jsonb_build_object('status', a.status, 'effectiveScore', 0);
        else
          if a.status not in ('completed','abandoned') then
            raise exception 'attempt_not_terminal' using errcode = '55000';
          end if;
          points := (input->>'score')::integer;
          if points not between 0 and 100 then raise exception 'invalid_score' using errcode = '22023'; end if;
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
            amount, reason, created_by_player_id, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'adjustment', points - balance, input->>'reason', actor, 'adjust:' || actor || ':' || key);
          update public.attempts set lock_version = lock_version + 1 where id = a.id returning * into a;
          -- Corrections preserve the immutable original score/status.
          result := jsonb_build_object('status', a.status, 'effectiveScore', points);
        end if;
  return result;
end;
$$;
alter function private.handle_attempt_admin_command(text, jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) owner to postgres;
revoke all on function private.handle_attempt_admin_command(text, jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) from public, anon, authenticated, service_role;
