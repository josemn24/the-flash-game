-- These guards reinforce structural invariants. They do not implement the 31 scoring
-- contracts or replace authorized, transactional application commands. See README.md.
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.guard_player() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id then raise exception 'Player identity is immutable'; end if;
  if old.status = 'anonymized' and new is distinct from old then
    raise exception 'Anonymized player cannot be restored by an ordinary update';
  end if;
  if (old.auth_user_id is not null and new.auth_user_id is null) or new.status = 'anonymized' then
    new.auth_user_id := null;
    new.display_name := 'Participante anonimizado';
    new.avatar_path := null;
    new.status := 'anonymized';
    new.anonymized_at := coalesce(old.anonymized_at, statement_timestamp());
  end if;
  return new;
end;
$$;
create trigger players_guard before update on public.players
  for each row execute function private.guard_player();

create function private.guard_room() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then raise exception 'Room identity is immutable'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone';
  end if;
  return new;
end;
$$;
create trigger rooms_guard before insert or update on public.rooms
  for each row execute function private.guard_room();

create function private.lock_membership_room() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id, new.room_id, new.player_id) is distinct from
    (old.id, old.room_id, old.player_id) then raise exception 'Membership identity is immutable'; end if;
  perform 1 from public.rooms where id = coalesce(new.room_id, old.room_id) for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger memberships_lock before insert or update or delete on public.room_memberships
  for each row execute function private.lock_membership_room();

create function private.require_room_owner() returns trigger
language plpgsql set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'rooms' then target_id := new.id;
  else target_id := coalesce(new.room_id, old.room_id); end if;
  if exists (select 1 from public.rooms where id = target_id and status = 'active')
    and (select count(*) from public.room_memberships where room_id = target_id
      and role = 'owner' and status = 'active') <> 1 then
    raise exception 'An active room requires exactly one active owner';
  end if;
  return null;
end;
$$;
create constraint trigger rooms_require_owner after insert or update on public.rooms
  deferrable initially deferred for each row execute function private.require_room_owner();
create constraint trigger memberships_require_owner after insert or update or delete on public.room_memberships
  deferrable initially deferred for each row execute function private.require_room_owner();

create function private.guard_season() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.id, new.room_id) is distinct from (old.id, old.room_id) then
    raise exception 'Season identity and room are immutable';
  end if;
  if old.status in ('finished', 'cancelled') and new is distinct from old then
    raise exception 'Terminal seasons are immutable; corrections require a dedicated audited operation';
  end if;
  if old.status <> 'draft' and (new.title, new.starts_at, new.ends_at) is distinct from
    (old.title, old.starts_at, old.ends_at) then
    raise exception 'Only draft seasons may change their configuration';
  end if;
  if old.status = 'active' and new.status not in ('active', 'finished', 'cancelled') then
    raise exception 'An active season cannot return to preparation';
  end if;
  return new;
end;
$$;
create trigger seasons_guard before update on public.seasons
  for each row execute function private.guard_season();

create function private.guard_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Create a draft before publishing'; end if;
    return new;
  end if;
  if old.status <> 'draft' then
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'archived'
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'Published content is immutable; create another version';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id then raise exception 'Version identity is immutable'; end if;
  if new.status = 'archived' then raise exception 'Publish before archiving a version'; end if;
  if new.status = 'published' then
    if tg_table_name = 'question_versions' then
      if not exists (select 1 from private.question_version_solutions where question_version_id = new.id) then
        raise exception 'A published question requires a solution';
      end if;
    else
      perform 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id for share of q;
      if (select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = new.id) <> 100 then
        raise exception 'Challenge items must sum to 100 points';
      end if;
      if exists (select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id and q.status <> 'published') then
        raise exception 'Publish every question before its challenge';
      end if;
    end if;
    new.published_at := statement_timestamp();
  end if;
  return new;
end;
$$;
create trigger questions_freeze before insert or update or delete on private.question_versions
  for each row execute function private.guard_version();
create trigger challenges_freeze before insert or update or delete on private.challenge_versions
  for each row execute function private.guard_version();

create function private.guard_content_child() returns trigger
language plpgsql set search_path = '' as $$
declare parent_id uuid; parent_status text;
begin
  if tg_table_name = 'challenge_items' then
    parent_id := coalesce(new.challenge_version_id, old.challenge_version_id);
    if tg_op = 'UPDATE' and (new.id, new.challenge_version_id) is distinct from (old.id, old.challenge_version_id) then
      raise exception 'Item identity and parent are immutable';
    end if;
    select status into parent_status from private.challenge_versions where id = parent_id for update;
  else
    parent_id := coalesce(new.question_version_id, old.question_version_id);
    if tg_op = 'UPDATE' and new.question_version_id <> old.question_version_id then
      raise exception 'Solution parent is immutable';
    end if;
    select status into parent_status from private.question_versions where id = parent_id for update;
  end if;
  if parent_status is distinct from 'draft' then raise exception 'Published children are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger items_freeze before insert or update or delete on private.challenge_items
  for each row execute function private.guard_content_child();
create trigger solutions_freeze before insert or update or delete on private.question_version_solutions
  for each row execute function private.guard_content_child();

create function private.guard_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.season_id) is distinct from (old.id, old.season_id) then
      raise exception 'Publication identity and season are immutable';
    end if;
    if old.status <> 'scheduled' or statement_timestamp() >= old.opens_at then
      if (to_jsonb(new) - 'status' - 'cancelled_at' - 'results_locked_at' - 'updated_at') <>
        (to_jsonb(old) - 'status' - 'cancelled_at' - 'results_locked_at' - 'updated_at') then
        raise exception 'Only future scheduled publications may be reprogrammed';
      end if;
    end if;
    if old.status in ('closed', 'cancelled') and new.status not in (old.status, 'cancelled') then
      raise exception 'A terminal publication cannot reopen';
    end if;
    if old.status = 'open' and new.status not in ('open', 'closed', 'cancelled') then
      raise exception 'An open publication cannot return to scheduled';
    end if;
  end if;
  if tg_op = 'INSERT' or new.challenge_version_id is distinct from old.challenge_version_id then
    perform 1 from private.challenge_versions where id = new.challenge_version_id and status = 'published' for share;
    if not found then raise exception 'A publication requires a published challenge version'; end if;
  end if;
  return new;
end;
$$;
create trigger publications_guard before insert or update on public.scheduled_challenges
  for each row execute function private.guard_publication();

create function private.guard_attempt() returns trigger
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
create trigger attempts_guard before insert or update on public.attempts
  for each row execute function private.guard_attempt();

create function private.reject_rewrite() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Historical records cannot be overwritten or deleted';
end;
$$;
create trigger attempts_no_delete before delete on public.attempts
  for each row execute function private.reject_rewrite();
create trigger answers_append_only before update or delete on private.attempt_answers
  for each row execute function private.reject_rewrite();
create trigger entries_append_only before update or delete on private.flash_point_entries
  for each row execute function private.reject_rewrite();
create trigger audit_append_only before update or delete on private.audit_log
  for each row execute function private.reject_rewrite();

create function private.guard_answer() returns trigger
language plpgsql set search_path = '' as $$
declare a public.attempts%rowtype; item_points integer; r private.answer_receipts%rowtype;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.status is distinct from 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  select * into r from private.answer_receipts where id = new.receipt_id;
  if not found or (r.attempt_id, r.challenge_item_id, r.challenge_version_id) is distinct from
    (new.attempt_id, new.challenge_item_id, new.challenge_version_id) then
    raise exception 'A final answer requires its immutable receipt';
  end if;
  new.presented_at := r.presented_at;
  new.submitted_at := r.effective_submitted_at;
  new.time_used_ms := r.time_used_ms;
  new.answer := r.answer;
  -- Late timeout finalization uses the previously recorded reception, not evaluation time.
  if new.presented_at < a.started_at or new.presented_at > a.deadline_at
    or (new.submitted_at is not null and new.submitted_at > a.deadline_at) then
    raise exception 'Answer timestamps outside attempt deadline';
  end if;
  if exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
    raise exception 'Publication cancelled';
  end if;
  select points into item_points from private.challenge_items where id = new.challenge_item_id;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$$;
create trigger answers_guard before insert on private.attempt_answers
  for each row execute function private.guard_answer();

create function private.guard_point_entry() returns trigger
language plpgsql set search_path = '' as $$
declare a public.attempts%rowtype; balance bigint; has_accreditation boolean;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.kind is distinct from 'competitive' then raise exception 'Only competitive attempts earn points'; end if;
  select coalesce(sum(amount), 0), coalesce(bool_or(entry_type = 'accreditation'), false)
    into balance, has_accreditation from private.flash_point_entries where attempt_id = new.attempt_id;
  if new.entry_type = 'accreditation' then
    if a.status <> 'completed' or new.amount <> a.score or has_accreditation
      or exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
      raise exception 'Invalid initial accreditation';
    end if;
  else
    if not has_accreditation or not exists (
      select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
      where x.player_id = new.created_by_player_id and p.status = 'active' and p.auth_user_id is not null
    ) then raise exception 'A correction requires accreditation and an active superadministrator'; end if;
    if new.entry_type = 'adjustment' and (a.status <> 'completed' or exists (
      select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled'
    )) then raise exception 'Only eligible results may be adjusted'; end if;
  end if;
  if balance + new.amount not between 0 and 100 then raise exception 'Effective points must stay between 0 and 100'; end if;
  return new;
end;
$$;
create trigger entries_guard before insert on private.flash_point_entries
  for each row execute function private.guard_point_entry();

-- Server-maintained timestamps; order z_touch runs after the guards.
create trigger z_touch before update on public.players
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.rooms
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.room_memberships
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.seasons
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.scheduled_challenges
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on public.attempts
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.platform_role_assignments
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.room_invitations
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_definitions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_versions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.question_version_solutions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_definitions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_versions
  for each row execute function private.touch_updated_at();
create trigger z_touch before update on private.challenge_items
  for each row execute function private.touch_updated_at();

create trigger receipts_append_only before update or delete on private.answer_receipts
  for each row execute function private.reject_rewrite();
create trigger timing_units_immutable before update or delete on private.attempt_timing_units
  for each row execute function private.reject_rewrite();
create trigger requests_append_only before update or delete on private.command_requests
  for each row execute function private.reject_rewrite();
