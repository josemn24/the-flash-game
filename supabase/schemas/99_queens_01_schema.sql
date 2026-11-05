-- E05 — Tablas de eventos privados para Queens legado y validación dinámica.

create table private.queens_placement_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  cell integer not null check (cell between 0 and 24),
  action text not null check (action in ('place', 'remove')),
  conflicting boolean not null,
  penalty_applied boolean not null,
  penalty_points integer not null check (penalty_points >= 0),
  received_at timestamptz not null,
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id) on delete restrict,
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id) on delete restrict,
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (received_at >= presented_at),
  check (not penalty_applied or (action = 'place' and conflicting and penalty_points > 0)),
  check (penalty_applied or penalty_points = 0)
);

create index queens_placement_events_cell_idx
  on private.queens_placement_events(attempt_id, challenge_item_id, cell, sequence desc);

create table private.queens_validation_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  queens integer[] not null,
  correct boolean not null,
  conflicting_queens integer not null check (conflicting_queens >= 0),
  penalty_applied boolean not null,
  penalty_points integer not null check (penalty_points >= 0),
  received_at timestamptz not null,
  presented_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  foreign key (attempt_id, challenge_version_id)
    references public.attempts(id, challenge_version_id) on delete restrict,
  foreign key (challenge_item_id, challenge_version_id)
    references private.challenge_items(id, challenge_version_id) on delete restrict,
  unique (attempt_id, challenge_item_id, sequence),
  unique (attempt_id, idempotency_key),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (received_at >= presented_at),
  check (not penalty_applied or not correct),
  check (not penalty_applied or penalty_points > 0),
  check (penalty_applied or penalty_points = 0)
);

revoke all on table private.queens_placement_events from public, anon, authenticated, service_role;
alter table private.queens_placement_events enable row level security;
revoke all on table private.queens_validation_events from public, anon, authenticated, service_role;
alter table private.queens_validation_events enable row level security;
