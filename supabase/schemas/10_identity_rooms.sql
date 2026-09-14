create table public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (btrim(display_name) <> ''),
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'anonymized')),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'anonymized') = (anonymized_at is not null)),
  check (status <> 'anonymized' or (auth_user_id is null and avatar_path is null))
);

create table private.platform_role_assignments (
  player_id uuid primary key references public.players(id) on delete restrict,
  role text not null check (role = 'superadmin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  time_zone text not null default 'Europe/Madrid',
  status text not null default 'active' check (status in ('active', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'deleted') = (deleted_at is not null))
);

create table public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'member', 'spectator')),
  status text not null default 'active' check (status in ('active', 'left', 'removed', 'banned')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, player_id),
  check ((status = 'active') = (ended_at is null)),
  check (ended_at is null or ended_at >= joined_at),
  check (role <> 'owner' or status = 'active')
);

create table private.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  role text not null check (role in ('admin', 'member', 'spectator')),
  token_hash text not null unique check (btrim(token_hash) <> ''),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses integer check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (max_uses is null or use_count <= max_uses),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'active', 'finished', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

