-- Even public_payload is private at table level: delivery is progressive and authorized
-- by the server. Room spectators must not obtain playable content or future questions.
create table private.question_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (btrim(slug) <> ''),
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_definition_id uuid not null references private.question_definitions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  type text not null check (btrim(type) <> ''),
  public_payload jsonb not null check (jsonb_typeof(public_payload) = 'object'),
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_definition_id, version_number),
  check ((status = 'draft') = (published_at is null))
);

create table private.question_version_solutions (
  question_version_id uuid primary key references private.question_versions(id) on delete restrict,
  solution_payload jsonb not null check (jsonb_typeof(solution_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.challenge_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (btrim(slug) <> ''),
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.challenge_versions (
  id uuid primary key default gen_random_uuid(),
  challenge_definition_id uuid not null references private.challenge_definitions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  mode text not null check (mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid')),
  title text not null check (btrim(title) <> ''),
  subtitle text not null default '',
  description text not null default '',
  max_score integer not null default 100 check (max_score = 100),
  mode_config jsonb not null default '{}'::jsonb check (jsonb_typeof(mode_config) = 'object'),
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_definition_id, version_number),
  check ((status = 'draft') = (published_at is null))
);

create table private.challenge_items (
  id uuid primary key default gen_random_uuid(),
  challenge_version_id uuid not null references private.challenge_versions(id) on delete restrict,
  question_version_id uuid not null references private.question_versions(id) on delete restrict,
  position integer not null check (position > 0),
  points integer not null check (points between 0 and 100),
  mode_config jsonb not null default '{}'::jsonb check (jsonb_typeof(mode_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_version_id, position),
  unique (id, challenge_version_id)
);

