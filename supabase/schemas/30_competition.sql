create table public.scheduled_challenges (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  challenge_version_id uuid not null references private.challenge_versions(id) on delete restrict,
  number integer not null check (number > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'open', 'closed', 'cancelled')),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  cancelled_at timestamptz,
  results_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at < closes_at),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  unique (season_id, number),
  unique (id, challenge_version_id),
  unique (id, season_id),
  exclude using gist (
    season_id extensions.gist_uuid_ops with =,
    tstzrange(opens_at, closes_at, '[)') with &&
  ) where (status <> 'cancelled')
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  scheduled_challenge_id uuid not null,
  challenge_version_id uuid not null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  kind text not null check (kind in ('competitive', 'test')),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'invalidated')),
  outcome text,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  completed_at timestamptz,
  score integer check (score between 0 and 100),
  client_state_schema_version integer not null check (client_state_schema_version > 0),
  lock_version bigint not null default 1 check (lock_version > 0),
  progress_payload jsonb check (jsonb_typeof(progress_payload) = 'object'),
  last_activity_at timestamptz,
  terminal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scheduled_challenge_id, challenge_version_id)
    references public.scheduled_challenges(id, challenge_version_id) on delete restrict,
  unique (id, challenge_version_id),
  unique (id, player_id, scheduled_challenge_id),
  unique (player_id, scheduled_challenge_id, kind, attempt_number),
  check (kind <> 'competitive' or attempt_number = 1),
  check (deadline_at > started_at),
  check (completed_at is null or completed_at >= started_at),
  check ((status = 'in_progress' and completed_at is null and score is null)
    or (status = 'completed' and completed_at is not null and score is not null)
    or (status = 'abandoned' and completed_at is not null and score is null)
    or (status = 'invalidated' and completed_at is not null)),
  check (status = 'in_progress' or progress_payload is null)
);

create table private.attempt_sessions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete restrict,
  session_token_hash text not null unique check (btrim(session_token_hash) <> ''),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (last_seen_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create table private.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  status text not null check (status in ('correct', 'partial', 'incorrect', 'unanswered', 'timeout')),
  answer jsonb,
  result_details jsonb,
  points integer not null check (points between 0 and 100),
  presented_at timestamptz not null,
  submitted_at timestamptz,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id) on delete restrict,
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id) on delete restrict,
  unique (attempt_id, challenge_item_id),
  unique (attempt_id, idempotency_key),
  check (submitted_at is null or submitted_at >= presented_at)
);

create table private.flash_point_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  player_id uuid not null,
  scheduled_challenge_id uuid not null,
  attempt_id uuid not null,
  entry_type text not null check (entry_type in ('accreditation', 'adjustment', 'reversal')),
  amount integer not null check (amount between -100 and 100),
  reason text,
  created_by_player_id uuid references public.players(id) on delete restrict,
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  created_at timestamptz not null default now(),
  foreign key (scheduled_challenge_id, season_id)
    references public.scheduled_challenges(id, season_id) on delete restrict,
  foreign key (attempt_id, player_id, scheduled_challenge_id)
    references public.attempts(id, player_id, scheduled_challenge_id) on delete restrict,
  check ((entry_type = 'accreditation' and amount >= 0)
    or (entry_type in ('adjustment', 'reversal') and reason is not null
      and btrim(reason) <> '' and created_by_player_id is not null)),
  check (entry_type <> 'reversal' or amount <= 0)
);

create table private.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_player_id uuid references public.players(id) on delete restrict,
  action text not null check (btrim(action) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id uuid,
  reason text,
  request_id text,
  before_payload jsonb,
  after_payload jsonb,
  created_at timestamptz not null default now()
);
