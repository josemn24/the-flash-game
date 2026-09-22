-- E06 — Authoritative word-search selection events and command.

create table private.word_search_selection_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  challenge_version_id uuid not null,
  sequence integer not null check (sequence > 0),
  start_cell integer not null check (start_cell >= 0),
  end_cell integer not null check (end_cell >= 0),
  matched_target_id text,
  correct boolean not null,
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
  check (start_cell <> end_cell)
);

create index word_search_selection_events_item_idx
  on private.word_search_selection_events(attempt_id, challenge_item_id, sequence);
create index word_search_selection_events_target_idx
  on private.word_search_selection_events(attempt_id, challenge_item_id, matched_target_id)
  where correct;
create unique index word_search_selection_events_correct_target_idx
  on private.word_search_selection_events(attempt_id, challenge_item_id, matched_target_id)
  where correct and matched_target_id is not null;

create function private.word_search_progress(target_attempt uuid, target_item uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kind', 'word-search',
    'foundSelections', coalesce(jsonb_agg(jsonb_build_object(
      'targetId', e.matched_target_id,
      'startCell', e.start_cell,
      'endCell', e.end_cell
    ) order by e.sequence) filter (where e.correct), '[]'::jsonb),
    'foundWordIds', coalesce(jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      filter (where e.correct), '[]'::jsonb),
    'foundCount', count(*) filter (where e.correct)::integer,
    'totalWords', jsonb_array_length(q.public_payload->'targets'),
    'incorrectAttempts', count(*) filter (where not e.correct)::integer
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  left join private.word_search_selection_events e
    on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'word-search'
  group by q.public_payload
$$;

create function private.submit_word_search_selection(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.word_search_selection_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  start_cell_i integer;
  end_cell_i integer;
  target_id text;
  total_words integer;
  grid_rows integer;
  grid_columns integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  terminal boolean;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'startCell') is distinct from 'number'
    or jsonb_typeof(input->'endCell') is distinct from 'number'
    or (input->>'startCell')::numeric <> trunc((input->>'startCell')::numeric)
    or (input->>'endCell')::numeric <> trunc((input->>'endCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  start_cell_i := (input->>'startCell')::integer;
  end_cell_i := (input->>'endCell')::integer;
  if start_cell_i < 0 or end_cell_i < 0 or start_cell_i = end_cell_i then
    raise exception 'invalid_word_search_selection' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_search_selection' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-search' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(question.public_payload->'letters') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'targets') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'positionsByTargetId') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  total_words := jsonb_array_length(question.public_payload->'targets');
  grid_rows := (question.public_payload->'grid'->>'rows')::integer;
  grid_columns := (question.public_payload->'grid'->>'columns')::integer;

  select positions.key into target_id
  from jsonb_each(solution.solution_payload->'positionsByTargetId') positions
  where (positions.value->>'startCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'endCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'startCell')::integer <> (positions.value->>'endCell')::integer
  limit 1;
  if target_id is null then
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i >= grid_rows * grid_columns or end_cell_i >= grid_rows * grid_columns
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_word_search_selection' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id
      and e.correct and e.matched_target_id = target_id) then
    raise exception 'word_search_target_already_found' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;

  insert into private.word_search_selection_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    start_cell, end_cell, matched_target_id, correct,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    start_cell_i, end_cell_i, target_id, target_id is not null,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.word_search_progress(a.id, item.id);
  terminal := (progress->>'foundCount')::integer = total_words;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id, progress->'foundWordIds', instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'startCell', event.start_cell, 'endCell', event.end_cell,
    'correct', event.correct, 'terminal', terminal,
    'matchedTargetId', event.matched_target_id,
    'foundSelections', progress->'foundSelections', 'foundWordIds', progress->'foundWordIds',
    'foundCount', progress->'foundCount', 'totalWords', progress->'totalWords',
    'incorrectAttempts', progress->'incorrectAttempts'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_search_selection', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'startCell', event.start_cell,
        'endCell', event.end_cell, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_search_selection', safe_input, result);
  return result;
end;
$$;

alter function private.word_search_progress(uuid, uuid) owner to postgres;
alter function private.submit_word_search_selection(jsonb) owner to postgres;
alter table private.word_search_selection_events enable row level security;
revoke all on table private.word_search_selection_events from public, anon, authenticated, service_role;
revoke all on function private.word_search_progress(uuid, uuid), private.submit_word_search_selection(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.submit_word_search_selection(jsonb) to service_role;
