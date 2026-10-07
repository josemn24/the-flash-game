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

-- Pyramid payloads can be prepared before the level clock starts. The row is
-- consumed atomically by activate_interaction once the client has mounted the
-- question shell.
create table private.prepared_interactions (
  attempt_id uuid primary key,
  challenge_version_id uuid not null,
  challenge_item_id uuid not null,
  prepared_at timestamptz not null default clock_timestamp(),
  foreign key (attempt_id, challenge_version_id) references public.attempts(id, challenge_version_id),
  foreign key (challenge_item_id, challenge_version_id) references private.challenge_items(id, challenge_version_id),
  unique (attempt_id, challenge_item_id)
);
create index prepared_item_idx on private.prepared_interactions(challenge_item_id, challenge_version_id);

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
alter table private.prepared_interactions enable row level security;
alter table private.answer_receipts enable row level security;
revoke all on private.command_requests, private.attempt_timing_units,
  private.interaction_intervals, private.prepared_interactions, private.answer_receipts
  from public, anon, authenticated, service_role;

-- Shared terminal closure for competitive attempts. The caller must already
-- hold the membership/room lock when this is used for permission revocation.
-- It deliberately preserves receipts/evaluations and never writes points.
create function private.close_attempt_as_abandoned(
  target_attempt uuid,
  closed_at timestamptz,
  terminal_reason_value text,
  audit_actor uuid,
  audit_request_id text,
  audit_reason text
) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  attempt_row public.attempts%rowtype;
  before_payload jsonb;
begin
  if terminal_reason_value not in ('abandon', 'inactivity_timeout', 'permission_revoked')
    or closed_at is null
    or audit_request_id is null then
    raise exception 'invalid_attempt_closure' using errcode = '22023';
  end if;

  select * into attempt_row
  from public.attempts
  where id = target_attempt
  for update;

  if not found or attempt_row.kind <> 'competitive' or attempt_row.status <> 'in_progress' then
    return false;
  end if;

  before_payload := jsonb_build_object(
    'status', attempt_row.status,
    'lockVersion', attempt_row.lock_version,
    'score', attempt_row.score,
    'lastActivityAt', attempt_row.last_activity_at,
    'deadlineAt', attempt_row.deadline_at
  );

  update private.interaction_intervals interval_row
  set ended_at = greatest(interval_row.started_at, least(closed_at, timing_unit.deadline_at)),
      end_reason = 'abandon'
  from private.attempt_timing_units timing_unit
  where interval_row.attempt_id = attempt_row.id
    and interval_row.ended_at is null
    and timing_unit.id = interval_row.timing_unit_id;

  delete from private.prepared_interactions where attempt_id = attempt_row.id;

  update public.attempts
  set status = 'abandoned',
      score = null,
      outcome = null,
      completed_at = closed_at,
      progress_payload = null,
      terminal_reason = terminal_reason_value,
      lock_version = lock_version + 1
  where id = attempt_row.id and status = 'in_progress'
  returning * into attempt_row;

  if not found then return false; end if;

  update private.attempt_sessions
  set revoked_at = closed_at
  where attempt_id = attempt_row.id and revoked_at is null;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    audit_actor,
    case when terminal_reason_value = 'inactivity_timeout'
      then 'expire_stale_attempt'
      else 'close_attempt_' || terminal_reason_value
    end,
    'attempt', attempt_row.id,
    audit_reason, audit_request_id, before_payload,
    jsonb_build_object(
      'status', 'abandoned',
      'lockVersion', attempt_row.lock_version,
      'score', null,
      'completedAt', closed_at,
      'terminalReason', terminal_reason_value
    )
  );
  return true;
end;
$$;
alter function private.close_attempt_as_abandoned(uuid, timestamptz, text, uuid, text, text)
  owner to postgres;
revoke all on function private.close_attempt_as_abandoned(uuid, timestamptz, text, uuid, text, text)
  from public, anon, authenticated, service_role;

create function private.close_attempts_for_permission_loss(
  target_player uuid,
  target_room uuid,
  closed_at timestamptz,
  audit_actor uuid,
  audit_request_id text
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  attempt_id uuid;
  closed_count integer := 0;
begin
  for attempt_id in
    select attempt.id
    from public.attempts attempt
    join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
    join public.seasons season on season.id = schedule.season_id
    where attempt.player_id = target_player
      and attempt.kind = 'competitive'
      and attempt.status = 'in_progress'
      and season.room_id = target_room
    order by attempt.id
    for update of attempt
  loop
    if private.close_attempt_as_abandoned(
      attempt_id,
      closed_at,
      'permission_revoked',
      audit_actor,
      audit_request_id || ':permission_revoked:' || attempt_id::text,
      'Competitive permission revoked for the room membership'
    ) then
      closed_count := closed_count + 1;
    end if;
  end loop;
  return closed_count;
end;
$$;
alter function private.close_attempts_for_permission_loss(uuid, uuid, timestamptz, uuid, text)
  owner to postgres;
revoke all on function private.close_attempts_for_permission_loss(uuid, uuid, timestamptz, uuid, text)
  from public, anon, authenticated, service_role;
