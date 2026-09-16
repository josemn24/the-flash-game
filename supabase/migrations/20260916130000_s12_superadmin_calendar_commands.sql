-- Generated from the declarative S12 schema plus the effective-clock helpers
-- required by the public read and gameplay boundaries.
create function private.publication_effective_status(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns text
language sql stable set search_path = '' as $$
  select case
    when raw_status = 'cancelled' then 'cancelled'
    when raw_status = 'closed' then 'closed'
    when season_status <> 'active' then 'closed'
    when at_time < season_starts_at or at_time < opens_at then 'upcoming'
    when at_time >= season_ends_at or at_time >= closes_at then 'closed'
    else 'available'
  end
$$;

create function private.publication_is_effectively_open(
  raw_status text,
  season_status text,
  season_starts_at timestamptz,
  season_ends_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  at_time timestamptz
) returns boolean
language sql stable set search_path = '' as $$
  select private.publication_effective_status(
    raw_status, season_status, season_starts_at, season_ends_at,
    opens_at, closes_at, at_time
  ) = 'available'
$$;

\ir ../schemas/59_superadmin_calendar_commands.sql
