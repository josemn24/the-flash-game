-- S12 migration companion: a delayed tick must not make a live window
-- unplayable, and a closed/finished window must reject new attempts.
create or replace function private.guard_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' then raise exception 'An attempt must start in progress'; end if;
    new.started_at := clock_timestamp();
    -- Derive the global clock from the exact persisted start, including very short limits.
    -- Other modes have only question/level clocks; never accept a caller's global deadline.
    select case when cv.mode = 'alphabet' then
      new.started_at + cv.global_time_limit_ms * interval '1 millisecond' else null end
      into new.deadline_at from private.challenge_versions cv where cv.id = new.challenge_version_id;
    if new.kind = 'competitive' then
      if exists (select 1 from private.platform_role_assignments where player_id = new.player_id) then
        raise exception 'Superadministrators only create test attempts';
      end if;
      perform 1 from public.scheduled_challenges sc
        join public.seasons s on s.id = sc.season_id
        join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id and m.player_id = new.player_id
        join public.players p on p.id = m.player_id
        where sc.id = new.scheduled_challenge_id
          and private.publication_is_effectively_open(
            sc.status, s.status, s.starts_at, s.ends_at,
            sc.opens_at, sc.closes_at, new.started_at
          )
          and r.status = 'active'
          and m.status = 'active' and m.role in ('owner', 'admin', 'member')
          and p.status = 'active' and p.auth_user_id is not null
        for share of sc, s, r, m, p;
      if not found then raise exception 'No competitive access or publication unavailable'; end if;
    else
      if not exists (select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
        where x.player_id = new.player_id and p.status = 'active' and p.auth_user_id is not null) then
        raise exception 'Test attempts require a superadministrator';
      end if;
    end if;
    return new;
  end if;
  if (new.id, new.player_id, new.scheduled_challenge_id, new.challenge_version_id, new.kind,
      new.attempt_number, new.started_at, new.deadline_at) is distinct from
     (old.id, old.player_id, old.scheduled_challenge_id, old.challenge_version_id, old.kind,
      old.attempt_number, old.started_at, old.deadline_at) then
    raise exception 'Attempt context is immutable';
  end if;
  if new.lock_version <> old.lock_version + 1 then raise exception 'Expected next lock_version'; end if;
  if old.status <> 'in_progress' then
    if new.status = old.status and (to_jsonb(new) - 'lock_version' - 'updated_at') =
      (to_jsonb(old) - 'lock_version' - 'updated_at') then return new; end if;
    if old.status not in ('completed', 'abandoned') or new.status <> 'invalidated'
      or (to_jsonb(new) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') <>
         (to_jsonb(old) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') then
      raise exception 'Terminal attempts cannot be replayed or overwritten';
    end if;
  elsif new.status = 'invalidated' then
    raise exception 'Complete or abandon before administrative invalidation';
  end if;
  return new;
end;
$$;

alter function private.guard_attempt() owner to postgres;
revoke all on function private.guard_attempt() from public, anon, authenticated, service_role;
