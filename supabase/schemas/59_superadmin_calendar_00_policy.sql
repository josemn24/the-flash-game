-- Shared calendar policy. Time is supplied after the caller acquires its locks.
create function private.season_calendar_permissions(season public.seasons, instant timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'canEditStart', season.status = 'draft' or (
      season.status in ('active','scheduled') and season.ends_at > instant
      and not exists (select 1 from public.scheduled_challenges p
        where p.season_id = season.id and p.status <> 'cancelled' and p.opens_at <= instant)
      and not exists (select 1 from public.attempts a join public.scheduled_challenges p
        on p.id = a.scheduled_challenge_id where p.season_id = season.id and a.kind = 'competitive')),
    'canEditEnd', season.status = 'draft' or (season.status in ('active','scheduled') and season.ends_at > instant),
    'blockedReason', case
      when season.status in ('finished','cancelled') or (season.status <> 'draft' and season.ends_at <= instant)
        then 'season_finished'
      else null end
  )
$$;

create function private.publication_calendar_permissions(publication public.scheduled_challenges, instant timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'canEditWindow', p.status not in ('closed','cancelled') and (
      s.status = 'draft' or (s.status in ('active','scheduled') and s.ends_at > instant and p.opens_at > instant))
      and not exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.kind='competitive'),
    'canExtendClose', p.status not in ('closed','cancelled') and s.status in ('active','scheduled')
      and s.ends_at > instant and p.opens_at <= instant and p.closes_at > instant,
    'blockedReason', case
      when s.status in ('finished','cancelled') or (s.status <> 'draft' and s.ends_at <= instant) then 'season_finished'
      when p.status in ('closed','cancelled') or (s.status <> 'draft' and p.closes_at <= instant) then 'schedule_finished'
      when s.status <> 'draft' and p.opens_at <= instant then 'opening_reached'
      when exists(select 1 from public.attempts a where a.scheduled_challenge_id=p.id and a.kind='competitive') then 'competitive_attempt_exists'
      else null end
  ) from public.scheduled_challenges p join public.seasons s on s.id=p.season_id where p.id=publication.id
$$;

create function private.assert_season_calendar_window(season public.seasons, starts_value timestamptz, ends_value timestamptz, instant timestamptz) returns void
language plpgsql stable set search_path = '' as $$
declare permissions jsonb := private.season_calendar_permissions(season, instant);
begin
  if starts_value is null or ends_value is null or not isfinite(starts_value) or not isfinite(ends_value) or starts_value >= ends_value then
    raise exception 'invalid_season_dates' using errcode='22007';
  end if;
  if (starts_value,ends_value) is not distinct from (season.starts_at,season.ends_at) then return; end if;
  if not (permissions->>'canEditEnd')::boolean then raise exception 'season_finished' using errcode='55000'; end if;
  if starts_value <> season.starts_at and not (permissions->>'canEditStart')::boolean then
    raise exception 'season_start_locked' using errcode='55000';
  end if;
  if season.status <> 'draft' and ends_value <= instant then raise exception 'invalid_season_dates' using errcode='22007'; end if;
end $$;

create function private.assert_publication_calendar_window(publication public.scheduled_challenges, opens_value timestamptz, closes_value timestamptz, instant timestamptz) returns void
language plpgsql stable set search_path = '' as $$
declare permissions jsonb := private.publication_calendar_permissions(publication,instant); season_status text;
begin
  if opens_value is null or closes_value is null or not isfinite(opens_value) or not isfinite(closes_value) or opens_value >= closes_value then
    raise exception 'invalid_schedule_dates' using errcode='22007';
  end if;
  if (opens_value,closes_value) is not distinct from (publication.opens_at,publication.closes_at) then return; end if;
  if (permissions->>'canEditWindow')::boolean then
    select status into season_status from public.seasons where id=publication.season_id;
    if season_status <> 'draft' and opens_value <= instant then raise exception 'invalid_schedule_dates' using errcode='22007'; end if;
    return;
  end if;
  if (permissions->>'canExtendClose')::boolean and opens_value=publication.opens_at and closes_value>=publication.closes_at then return; end if;
  raise exception '%', coalesce(permissions->>'blockedReason','schedule_not_editable') using errcode='55000';
end $$;

-- A deferred constraint trigger checks the final parent/child windows during bulk changes.
create function private.assert_calendar_containment() returns trigger
language plpgsql set search_path = '' as $$
declare season_id_value uuid;
begin
  if tg_table_name='seasons' then season_id_value:=new.id; else season_id_value:=new.season_id; end if;
  if exists(select 1 from public.scheduled_challenges p join public.seasons s on s.id=p.season_id
    where s.id=season_id_value and p.status<>'cancelled' and (p.opens_at<s.starts_at or p.closes_at>s.ends_at)) then
    raise exception 'schedule_outside_season' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger season_calendar_containment after insert or update on public.seasons
  deferrable initially immediate for each row execute function private.assert_calendar_containment();
create constraint trigger publication_calendar_containment after insert or update on public.scheduled_challenges
  deferrable initially immediate for each row execute function private.assert_calendar_containment();

alter function private.season_calendar_permissions(public.seasons,timestamptz) owner to postgres;
alter function private.publication_calendar_permissions(public.scheduled_challenges,timestamptz) owner to postgres;
alter function private.assert_season_calendar_window(public.seasons,timestamptz,timestamptz,timestamptz) owner to postgres;
alter function private.assert_publication_calendar_window(public.scheduled_challenges,timestamptz,timestamptz,timestamptz) owner to postgres;
alter function private.assert_calendar_containment() owner to postgres;
revoke all on function private.season_calendar_permissions(public.seasons,timestamptz),
  private.publication_calendar_permissions(public.scheduled_challenges,timestamptz),
  private.assert_season_calendar_window(public.seasons,timestamptz,timestamptz,timestamptz),
  private.assert_publication_calendar_window(public.scheduled_challenges,timestamptz,timestamptz,timestamptz),
  private.assert_calendar_containment() from public,anon,authenticated,service_role;
