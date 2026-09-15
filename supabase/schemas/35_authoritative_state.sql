-- Operational state is private, never a gameplay payload or a public RPC surface.
create table private.command_requests (
  actor_id uuid not null references public.players(id) on delete restrict,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  operation text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (actor_id, idempotency_key)
);

create table private.attempt_timing_units (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_version_id uuid not null,
  challenge_item_id uuid not null,
  scope text not null check (scope in ('question', 'level', 'attempt')),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  foreign key (attempt_id, challenge_version_id) references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id) references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id),
  unique (id, attempt_id, challenge_item_id),
  check (deadline_at > started_at)
);

create table private.interaction_intervals (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  timing_unit_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('answer', 'pass', 'timeout', 'abandon', 'recovery_interrupted')),
  foreign key (timing_unit_id, attempt_id, challenge_item_id)
    references private.attempt_timing_units(id, attempt_id, challenge_item_id),
  check ((ended_at is null) = (end_reason is null)),
  check (ended_at is null or ended_at >= started_at)
);
create unique index intervals_one_open_idx on private.interaction_intervals(attempt_id) where ended_at is null;
create index intervals_item_idx on private.interaction_intervals(attempt_id, challenge_item_id, started_at);
create index intervals_unit_idx on private.interaction_intervals(timing_unit_id, attempt_id, challenge_item_id);
create index timing_item_version_idx on private.attempt_timing_units(challenge_item_id, challenge_version_id);

create table private.answer_receipts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  answer jsonb,
  received_at timestamptz not null,
  presented_at timestamptz not null,
  effective_submitted_at timestamptz not null,
  time_used_ms bigint not null check (time_used_ms >= 0),
  timed_out boolean not null,
  client_time_used_ms bigint check (client_time_used_ms >= 0),
  foreign key (attempt_id, challenge_version_id) references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id) references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id),
  unique (id, attempt_id, challenge_item_id, challenge_version_id),
  check (effective_submitted_at >= presented_at),
  check (received_at >= effective_submitted_at)
);
create index receipts_item_idx on private.answer_receipts(challenge_item_id, challenge_version_id);
alter table private.attempt_answers add column receipt_id uuid not null;
alter table private.attempt_answers add constraint answers_receipt_fk
  foreign key (receipt_id, attempt_id, challenge_item_id, challenge_version_id)
  references private.answer_receipts(id, attempt_id, challenge_item_id, challenge_version_id);
create unique index answers_receipt_idx on private.attempt_answers(receipt_id);

alter table private.command_requests enable row level security;
alter table private.attempt_timing_units enable row level security;
alter table private.interaction_intervals enable row level security;
alter table private.answer_receipts enable row level security;
revoke all on private.command_requests, private.attempt_timing_units,
  private.interaction_intervals, private.answer_receipts from public, anon, authenticated, service_role;
