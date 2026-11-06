-- Per-question accepted-answer regrading. Existing answers remain immutable; only effective ledger points change.

begin;

set local check_function_bodies = off;

alter table private.flash_point_entries drop constraint flash_point_entries_check;
alter table private.flash_point_entries drop constraint flash_point_entries_entry_type_check;
alter table private.flash_point_entries add constraint flash_point_entries_check
  check ((entry_type = 'accreditation' and amount >= 0)
    or (entry_type in ('adjustment', 'answer_regrade', 'reversal') and reason is not null
      and btrim(reason) <> '' and created_by_player_id is not null));
alter table private.flash_point_entries add constraint flash_point_entries_entry_type_check
  check (entry_type in ('accreditation', 'adjustment', 'answer_regrade', 'reversal'));

create table private.attempt_answer_regrades (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  challenge_item_id uuid not null,
  rubric_question_version_id uuid not null references private.question_versions(id) on delete restrict,
  attempt_lock_version bigint not null check (attempt_lock_version > 0),
  before_status text not null check (before_status in ('correct', 'partial', 'incorrect')),
  before_points integer not null check (before_points between 0 and 100),
  before_details jsonb,
  after_status text not null check (after_status in ('correct', 'partial', 'incorrect')),
  after_points integer not null check (after_points between 0 and 100),
  after_details jsonb,
  reason text not null check (btrim(reason) <> ''),
  actor_player_id uuid not null references public.players(id) on delete restrict,
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  created_at timestamptz not null default now(),
  foreign key (attempt_id, challenge_item_id)
    references private.attempt_answers(attempt_id, challenge_item_id) on delete cascade
);
create unique index attempt_answer_regrades_item_version_idx
  on private.attempt_answer_regrades (attempt_id, challenge_item_id, attempt_lock_version desc);
alter table private.attempt_answer_regrades enable row level security;
revoke all on table private.attempt_answer_regrades from public, anon, authenticated, service_role;
grant select on table private.attempt_answer_regrades to service_role;
create trigger attempt_answer_regrades_append_only before update or delete on private.attempt_answer_regrades
  for each row execute function private.reject_rewrite();

create or replace function private.valid_regrade_accepted_answers(answers jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(answers) = 'array' then
    jsonb_array_length(answers) > 0 and not exists (
      select 1 from jsonb_array_elements(answers) accepted(value)
      where jsonb_typeof(accepted.value) <> 'string' or (accepted.value #>> '{}') !~ '[^[:space:]]'
    )
  else false end
$$;
alter function private.valid_regrade_accepted_answers(jsonb) owner to postgres;
revoke all on function private.valid_regrade_accepted_answers(jsonb) from public, anon, authenticated, service_role;

create or replace function private.read_attempt_answer_regrade_context(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := private.current_player_id();
  target_attempt public.attempts%rowtype;
  target_item private.challenge_items%rowtype;
  target_question private.question_versions%rowtype;
  target_answer private.attempt_answers%rowtype;
  target_schedule public.scheduled_challenges%rowtype;
  rubric private.question_versions%rowtype;
  rubric_solution jsonb;
  current_status text;
  current_points integer;
  current_rubric uuid;
  total_points integer;
  clues_revealed integer;
  clues_available integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['attemptId','challengeItemId','rubricQuestionVersionId','lockVersion']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'attemptId','challengeItemId','rubricQuestionVersionId','lockVersion'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into target_attempt from public.attempts a
  where a.id = (input->>'attemptId')::uuid;
  if not found or target_attempt.kind <> 'competitive' then
    raise exception 'not_competitive' using errcode = '55000';
  end if;
  if target_attempt.status <> 'completed' then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;
  if target_attempt.lock_version <> (input->>'lockVersion')::bigint then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into target_schedule from public.scheduled_challenges sc
  where sc.id = target_attempt.scheduled_challenge_id;
  if not found or target_schedule.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = '55000';
  end if;

  select * into target_item from private.challenge_items item
  where item.id = (input->>'challengeItemId')::uuid
    and item.challenge_version_id = target_attempt.challenge_version_id;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select * into target_question from private.question_versions question
  where question.id = target_item.question_version_id;
  select * into target_answer from private.attempt_answers answer
  where answer.attempt_id = target_attempt.id and answer.challenge_item_id = target_item.id;
  if not found or target_answer.status not in ('correct','partial','incorrect')
    or target_answer.submitted_at is null or target_answer.answer is null
    or jsonb_typeof(target_answer.answer) <> 'string'
    or (target_answer.answer #>> '{}') !~ '[^[:space:]]'
    or target_question.type not in ('short-text','progressive-image','progressive-clues') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into rubric from private.question_versions question
  where question.id = (input->>'rubricQuestionVersionId')::uuid;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select solution.solution_payload into rubric_solution
  from private.question_version_solutions solution
  where solution.question_version_id = rubric.id;
  if not found or rubric.status <> 'published'
    or rubric.question_definition_id <> target_question.question_definition_id
    or rubric.type <> target_question.type then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if not private.valid_regrade_accepted_answers(rubric_solution->'acceptedAnswers') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select correction.after_status, correction.after_points, correction.rubric_question_version_id
    into current_status, current_points, current_rubric
  from private.attempt_answer_regrades correction
  where correction.attempt_id = target_attempt.id and correction.challenge_item_id = target_item.id
  order by correction.attempt_lock_version desc limit 1;
  if not found then
    current_status := target_answer.status;
    current_points := target_answer.points;
    current_rubric := null;
  end if;
  select coalesce(sum(entry.amount), 0)::integer into total_points
  from private.flash_point_entries entry where entry.attempt_id = target_attempt.id;

  if target_question.type = 'progressive-clues' then
    select coalesce(max(event.clue_index), 1)::integer into clues_revealed
    from private.progressive_clue_reveal_events event
    where event.attempt_id = target_attempt.id and event.challenge_item_id = target_item.id;
    select event.available_points into clues_available
    from private.progressive_clue_reveal_events event
    where event.attempt_id = target_attempt.id and event.challenge_item_id = target_item.id
    order by event.clue_index desc limit 1;
    clues_available := coalesce(clues_available, target_item.points);
  end if;

  select jsonb_build_object(
    'receiptId', target_answer.receipt_id,
    'attemptId', target_attempt.id,
    'challengeItemId', target_item.id,
    'rubricQuestionVersionId', rubric.id,
    'expectedLockVersion', target_attempt.lock_version,
    'originalStatus', target_answer.status,
    'originalPoints', target_answer.points,
    'currentStatus', current_status,
    'currentPoints', current_points,
    'currentRubricVersionId', current_rubric,
    'effectiveScore', total_points,
    'rubricVersionNumber', rubric.version_number,
    'questionVersionId', target_question.id,
    'questionType', target_question.type,
    'payloadSchemaVersion', target_question.payload_schema_version,
    'publicPayload', target_question.public_payload,
    'solutionPayload', original_solution.solution_payload,
    'timeLimitMs', target_question.time_limit_ms,
    'itemPoints', target_item.points,
    'itemConfigSchemaVersion', target_item.config_schema_version,
    'itemConfig', target_item.mode_config,
    'mode', challenge.mode,
    'modeConfigSchemaVersion', challenge.config_schema_version,
    'modeConfig', challenge.mode_config,
    'answer', target_answer.answer,
    'receivedAt', target_answer.submitted_at,
    'timeUsedMs', target_answer.time_used_ms,
    'timedOut', false,
    'acceptedAnswers', rubric_solution->'acceptedAnswers',
    'progressiveCluesRevealed', clues_revealed,
    'progressiveClueAvailablePoints', clues_available
  ) into result
  from private.question_version_solutions original_solution
  join private.challenge_versions challenge on challenge.id = target_attempt.challenge_version_id
  where original_solution.question_version_id = target_question.id;
  return result;
end;
$$;
alter function private.read_attempt_answer_regrade_context(jsonb) owner to postgres;
revoke all on function private.read_attempt_answer_regrade_context(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.read_attempt_answer_regrade_context(jsonb) to service_role;

-- Hold the same command-key lock through evaluation and the final write. A retry
-- can use the stored result even when the attempt has since advanced.
create or replace function private.prepare_attempt_answer_regrade(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  required text[] := array['attemptId','challengeItemId','rubricQuestionVersionId','lockVersion','reason','idempotencyKey'];
  cached private.command_requests%rowtype;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object' or nullif(btrim(key), '') is null
    or not input ?& required
    or exists (select 1 from jsonb_object_keys(input) k where not k = any(required))
    or exists (select 1 from unnest(required) k where input->k = 'null'::jsonb) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found then
    if cached.operation <> 'regrade_answer'
      or (cached.input - array['resultStatus','resultPoints','resultDetails']) <> input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('result', cached.result);
  end if;
  return jsonb_build_object('context', private.read_attempt_answer_regrade_context(
    input - array['reason','idempotencyKey']
  ));
end;
$$;
alter function private.prepare_attempt_answer_regrade(jsonb) owner to postgres;
revoke all on function private.prepare_attempt_answer_regrade(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_attempt_answer_regrade(jsonb) to service_role;

create or replace function private.handle_attempt_answer_regrade_command(
  input jsonb,
  actor uuid,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  instant timestamptz,
  key text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  target_item private.challenge_items%rowtype;
  original_question private.question_versions%rowtype;
  rubric private.question_versions%rowtype;
  original_answer private.attempt_answers%rowtype;
  current_status text;
  current_points integer;
  current_details jsonb;
  proposed_status text := input->>'resultStatus';
  proposed_points integer := (input->>'resultPoints')::integer;
  difference integer;
  balance integer;
  next_balance integer;
  rubric_solution jsonb;
  result jsonb;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_attempt.status <> 'completed' then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;
  if target_schedule.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = '55000';
  end if;
  if nullif(btrim(input->>'reason'), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if target_attempt.kind <> 'competitive' then
    raise exception 'not_competitive' using errcode = '55000';
  end if;
  if proposed_status not in ('correct','partial','incorrect')
    or proposed_points < 0 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into target_item from private.challenge_items item
  where item.id = (input->>'challengeItemId')::uuid
    and item.challenge_version_id = target_attempt.challenge_version_id;
  if not found then raise exception 'invalid_command' using errcode = '22023'; end if;
  select * into original_question from private.question_versions question
  where question.id = target_item.question_version_id;
  if original_question.type not in ('short-text','progressive-image','progressive-clues') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  select * into original_answer from private.attempt_answers answer
  where answer.attempt_id = target_attempt.id and answer.challenge_item_id = target_item.id;
  if not found or original_answer.status not in ('correct','partial','incorrect')
    or original_answer.submitted_at is null or original_answer.answer is null
    or jsonb_typeof(original_answer.answer) <> 'string'
    or (original_answer.answer #>> '{}') !~ '[^[:space:]]' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select * into rubric from private.question_versions question
  where question.id = (input->>'rubricQuestionVersionId')::uuid;
  if not found or rubric.status <> 'published'
    or rubric.question_definition_id <> original_question.question_definition_id
    or rubric.type <> original_question.type then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  select solution.solution_payload into rubric_solution
  from private.question_version_solutions solution where solution.question_version_id = rubric.id;
  if not private.valid_regrade_accepted_answers(rubric_solution->'acceptedAnswers') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if proposed_points > target_item.points then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  select correction.after_status, correction.after_points, correction.after_details
    into current_status, current_points, current_details
  from private.attempt_answer_regrades correction
  where correction.attempt_id = target_attempt.id and correction.challenge_item_id = target_item.id
  order by correction.attempt_lock_version desc limit 1;
  if not found then
    current_status := original_answer.status;
    current_points := original_answer.points;
    current_details := original_answer.result_details;
  end if;

  select coalesce(sum(entry.amount), 0)::integer into balance
  from private.flash_point_entries entry where entry.attempt_id = target_attempt.id;
  difference := proposed_points - current_points;
  next_balance := balance + difference;
  if next_balance not between 0 and 100 then
    raise exception 'invalid_score' using errcode = '22023';
  end if;

  insert into private.attempt_answer_regrades (
    attempt_id, challenge_item_id, rubric_question_version_id, attempt_lock_version,
    before_status, before_points, before_details, after_status, after_points,
    after_details, reason, actor_player_id, idempotency_key
  ) values (
    target_attempt.id, target_item.id, rubric.id, target_attempt.lock_version,
    current_status, current_points, current_details, proposed_status, proposed_points,
    input->'resultDetails', input->>'reason', actor, 'regrade:' || actor::text || ':' || key
  );
  insert into private.flash_point_entries (
    season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
    amount, reason, created_by_player_id, idempotency_key
  ) values (
    target_schedule.season_id, target_attempt.player_id, target_schedule.id, target_attempt.id,
    'answer_regrade', difference, input->>'reason', actor, 'regrade:' || actor::text || ':' || key
  );
  update public.attempts set lock_version = lock_version + 1
  where id = target_attempt.id returning * into target_attempt;

  result := jsonb_build_object(
    'status', target_attempt.status,
    'effectiveScore', next_balance,
    'challengeItemId', target_item.id,
    'rubricQuestionVersionId', rubric.id,
    'beforeStatus', current_status,
    'beforePoints', current_points,
    'afterStatus', proposed_status,
    'afterPoints', proposed_points,
    'difference', difference,
    'lockVersion', target_attempt.lock_version
  );
  return result;
end;
$$;
alter function private.handle_attempt_answer_regrade_command(jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) owner to postgres;
revoke all on function private.handle_attempt_answer_regrade_command(jsonb, uuid, public.attempts, public.scheduled_challenges, timestamptz, text) from public, anon, authenticated, service_role;

create or replace function private.guard_point_entry() returns trigger
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
    if new.entry_type in ('adjustment', 'answer_regrade') and (a.status <> 'completed' or exists (
      select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled'
    )) then raise exception 'Only eligible results may be adjusted'; end if;
  end if;
  if balance + new.amount not between 0 and 100 then raise exception 'Effective points must stay between 0 and 100'; end if;
  return new;
end;
$$;

create or replace function private.handle_attempt_admin_command(
  op text,
  input jsonb,
  actor uuid,
  target_attempt public.attempts,
  target_schedule public.scheduled_challenges,
  instant timestamptz,
  key text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  balance integer;
  points integer;
  result jsonb;
begin
        if op = 'regrade_answer' then
          return private.handle_attempt_answer_regrade_command(input, actor, a, sc, instant, key);
        end if;
        if nullif(btrim(input->>'reason'), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
        if a.kind <> 'competitive' then raise exception 'not_competitive' using errcode = '55000'; end if;
        select coalesce(sum(amount),0)::integer into balance from private.flash_point_entries where attempt_id = a.id;
        if op = 'invalidate' then
          if a.status not in ('completed','abandoned') then raise exception 'attempt_not_terminal' using errcode = '55000'; end if;
          update public.attempts set status = 'invalidated', terminal_reason = input->>'reason', lock_version = lock_version + 1
            where id = a.id returning * into a;
          update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
          if exists (select 1 from private.flash_point_entries where attempt_id = a.id and entry_type = 'accreditation') then
            insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
              amount, reason, created_by_player_id, idempotency_key)
            values(sc.season_id, a.player_id, sc.id, a.id, 'reversal', -balance, input->>'reason', actor, 'invalidate:' || a.id);
          end if;
          result := jsonb_build_object('status', a.status, 'effectiveScore', 0);
        else
          if a.status not in ('completed','abandoned') then
            raise exception 'attempt_not_terminal' using errcode = '55000';
          end if;
          points := (input->>'score')::integer;
          if points not between 0 and 100 then raise exception 'invalid_score' using errcode = '22023'; end if;
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
            amount, reason, created_by_player_id, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'adjustment', points - balance, input->>'reason', actor, 'adjust:' || actor || ':' || key);
          update public.attempts set lock_version = lock_version + 1 where id = a.id returning * into a;
          -- Corrections preserve the immutable original score/status.
          result := jsonb_build_object('status', a.status, 'effectiveScore', points);
        end if;
  return result;
end;
$$;

create or replace function private.handle_attempt_command(
  op text,
  input jsonb,
  safe_input jsonb,
  actor uuid,
  cached_result jsonb,
  received_at timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  operation_outcome record;
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  session_row private.attempt_sessions%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  is_admin boolean;
  clear_progress boolean := false;
  allow_stale_timeout boolean := false;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust','regrade_answer') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'regrade_answer' and not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if op = 'start' then
    return private.handle_attempt_start(input, safe_input, actor, cached_result, is_admin);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op = 'takeover' and a.scheduled_challenge_id <> (input->>'scheduledChallengeId')::uuid then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if op not in ('invalidate','adjust','regrade_answer') then
      if a.player_id <> actor or a.kind <> 'competitive' or is_admin or not exists (
        select 1 from public.seasons s join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id
        where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
          and m.status = 'active' and m.role in ('owner','admin','member')
      ) then raise exception 'not_authorized' using errcode = '42501'; end if;
      if op <> 'takeover' then
        select * into session_row from private.attempt_sessions where attempt_id = a.id
          and session_token_hash = safe_input->>'sessionToken';
        if not found then
          raise exception 'session_revoked' using errcode = '42501';
        elsif session_row.revoked_at is not null then
          if session_row.revocation_reason = 'takeover' then
            raise exception 'session_transferred' using errcode = '42501';
          end if;
          if not (op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')) then
            raise exception 'session_revoked' using errcode = '42501';
          end if;
        end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached_result is not null then return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    expected := (input->>'lockVersion')::bigint;
    if expected is distinct from a.lock_version then
      allow_stale_timeout := expected < a.lock_version and (
        (op = 'receive' and input->'answer' = 'null'::jsonb and exists (
          select 1 from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and received >= unit.deadline_at
        )) or
        (op = 'receive' and input->'answer' <> 'null'::jsonb and exists (
          select 1
          from private.interaction_intervals ix
          join private.attempt_timing_units unit on unit.id = ix.timing_unit_id
          join private.challenge_items item on item.id = ix.challenge_item_id
          join private.question_versions question on question.id = item.question_version_id
          where ix.attempt_id = a.id and ix.ended_at is null
            and ix.challenge_item_id = (input->>'challengeItemId')::uuid
            and question.type = 'connect-pairs'
            and received < unit.deadline_at
            and (cv.mode <> 'time-trial' or received < a.deadline_at)
        )) or
        (op = 'complete' and cv.mode = 'time-trial' and a.deadline_at is not null
          and received >= a.deadline_at
          and private.time_trial_progress(a.id)->>'endReason' = 'time_limit')
      );
      if not allow_stale_timeout then
        raise exception 'stale_version' using errcode = '40001';
      end if;
    end if;
    if op not in ('invalidate','adjust','regrade_answer') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','regrade_answer','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        select * into operation_outcome from private.handle_attempt_takeover(input, safe_input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'prepare' then
        select * into operation_outcome from private.handle_attempt_prepare(a, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'activate' then
        if cv.mode <> 'pyramid' then raise exception 'invalid_command' using errcode = '22023'; end if;
        select * into operation_outcome from private.handle_attempt_activate(input, a, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'receive', 'pass' then
        select * into operation_outcome from private.handle_attempt_submission(op, input, a, cv, instant, received);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'evaluate' then
        select * into operation_outcome from private.handle_attempt_evaluation(input, a, cv);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'complete', 'abandon' then
        select * into operation_outcome from private.handle_attempt_closure(op, input, a, sc, cv, instant);
        a := operation_outcome.updated_attempt;
        result := operation_outcome.operation_result;
        clear_progress := operation_outcome.clear_progress;
      when 'invalidate', 'adjust', 'regrade_answer' then
        result := private.handle_attempt_admin_command(op, input, actor, a, sc, instant, key);
        select * into a from public.attempts where id = a.id;
    end case;
    if op not in ('complete','abandon','invalidate','adjust','regrade_answer') then
      update public.attempts
        set lock_version = lock_version + 1,
            last_activity_at = instant,
            progress_payload = case when clear_progress then null else progress_payload end
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
    if cv.mode = 'time-trial' then
      result := result || jsonb_build_object('timeTrial', private.time_trial_progress(a.id), 'terminalReason', a.terminal_reason);
    end if;
  end if;

  return jsonb_build_object(
    'result', result,
    'entityType', 'attempt',
    'entityId', a.id,
    'beforePayload', previous,
    'replayed', false
  );
end;
$$;

create or replace function private.execute_command(op text, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  received timestamptz := clock_timestamp();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  outcome jsonb;
  result jsonb;
  allowed text[];
  required text[];
begin
  case op
    when 'start' then
      allowed := array['idempotencyKey','scheduledChallengeId','sessionToken']; required := allowed;
    when 'takeover' then
      allowed := array['idempotencyKey','attemptId','scheduledChallengeId','lockVersion','newSessionToken']; required := allowed;
    when 'prepare' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'activate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'];
      allowed := required;
    when 'receive' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer'];
      allowed := required || array['clientTimeUsedMs'];
    when 'pass' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']; required := allowed;
    when 'evaluate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','receiptId','status','points'];
      allowed := required || array['resultDetails'];
    when 'complete' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken'];
      allowed := required || array['outcome','pendingEvaluation'];
    when 'abandon' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'accept_invitation' then
      allowed := array['idempotencyKey','invitationToken']; required := allowed;
    when 'invalidate' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason']; required := allowed;
    when 'adjust' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason','score']; required := allowed;
    when 'regrade_answer' then
      required := array['idempotencyKey','attemptId','lockVersion','reason','challengeItemId',
        'rubricQuestionVersionId','resultStatus','resultPoints'];
      allowed := required || array['resultDetails'];
    else raise exception 'unknown_command' using errcode = '22023';
  end case;
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& required or exists (select 1 from jsonb_object_keys(input) k where not k = any(allowed))
    or exists (select 1 from unnest(required) k where k <> 'answer' and input->k = 'null'::jsonb) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  -- Never persist reusable secrets, including in idempotency records or audit payloads.
  if input ? 'sessionToken' then safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken'))); end if;
  if input ? 'newSessionToken' then safe_input := jsonb_set(safe_input, '{newSessionToken}', to_jsonb(private.secret_hash(input->>'newSessionToken'))); end if;
  if input ? 'invitationToken' then safe_input := jsonb_set(safe_input, '{invitationToken}', to_jsonb(private.secret_hash(input->>'invitationToken'))); end if;
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> op or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if op = 'accept_invitation' then
    outcome := private.handle_invitation_command(input, safe_input, actor, cached.result);
  else
    outcome := private.handle_attempt_command(op, input, safe_input, actor, cached.result, received);
  end if;
  result := outcome->'result';
  if coalesce((outcome->>'replayed')::boolean, false) then return result; end if;

  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, case when op = 'takeover' then 'takeover_confirmed' else op end,
    outcome->>'entityType', (outcome->>'entityId')::uuid, input->>'reason', key,
    case when op = 'takeover' then
      nullif(outcome->'beforePayload', 'null'::jsonb) || jsonb_build_object('deadlineAt', result->'deadlineAt')
      else nullif(outcome->'beforePayload', 'null'::jsonb) end,
    -- Avoid persisting playable payloads or free-text answers into a second store.
    result - 'publicPayload' - 'answers');
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, op, safe_input, result);
  return result;
end;
$$;

create or replace function private.regrade_answer(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return private.execute_command('regrade_answer', input);
end;
$$;

alter function private.regrade_answer(jsonb) owner to postgres;
revoke all on function private.regrade_answer(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.regrade_answer(jsonb) to service_role;

create or replace function public.get_superadmin_room_attempts(
  target_room_id uuid,
  target_scheduled_challenge_id uuid,
  cursor_started_at timestamptz,
  cursor_attempt_id uuid,
  page_size integer
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  requested_page_size integer := least(greatest(coalesce(page_size, 50), 1), 100);
  publication_payload jsonb;
  attempt_payload jsonb;
  row_count integer := 0;
  last_started_at timestamptz;
  last_attempt_id uuid;
  next_cursor jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'scheduledChallengeId', schedule.id,
    'roomId', room.id,
    'roomTitle', room.title,
    'seasonId', season.id,
    'seasonTitle', season.title,
    'seasonStatus', season.status,
    'challengeVersionId', version.id,
    'challengeSlug', definition.slug,
    'versionNumber', version.version_number,
    'challengeTitle', version.title,
    'challengeSubtitle', version.subtitle,
    'mode', version.mode,
    'number', schedule.number,
    'status', schedule.status,
    'opensAt', schedule.opens_at,
    'closesAt', schedule.closes_at,
    'updatedAt', schedule.updated_at
  )
  into publication_payload
  from public.scheduled_challenges schedule
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where schedule.id = target_scheduled_challenge_id
    and room.id = target_room_id
    and room.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial');

  if publication_payload is null then return null; end if;

  with page as (
    select
      attempt.id,
      attempt.player_id,
      player.display_name,
      player.avatar_path,
      attempt.status,
      attempt.outcome,
      attempt.attempt_number,
      attempt.started_at,
      attempt.deadline_at,
      attempt.completed_at,
      attempt.score,
      attempt.lock_version,
      coalesce((select sum(entry.amount)::integer
        from private.flash_point_entries entry where entry.attempt_id = attempt.id), 0) as effective_score,
      exists (select 1 from private.flash_point_entries entry
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'answer_regrade', 'reversal')) as is_corrected
    from public.attempts attempt
    join public.players player on player.id = attempt.player_id
    where attempt.scheduled_challenge_id = target_scheduled_challenge_id
      and attempt.kind = 'competitive'
      and player.status in ('active', 'anonymized')
      and (
        cursor_started_at is null
        or (attempt.started_at, attempt.id) < (cursor_started_at, cursor_attempt_id)
      )
    order by attempt.started_at desc, attempt.id desc
    limit requested_page_size
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'attemptId', page.id,
      'playerId', page.player_id,
      'displayName', page.display_name,
      'avatarPath', page.avatar_path,
      'status', page.status,
      'outcome', page.outcome,
      'attemptNumber', page.attempt_number,
      'startedAt', page.started_at,
      'deadlineAt', page.deadline_at,
      'completedAt', page.completed_at,
      'originalScore', page.score,
      'effectiveScore', page.effective_score,
      'lockVersion', page.lock_version,
      'isCorrected', page.is_corrected
    ) order by page.started_at desc, page.id desc), '[]'::jsonb),
    count(*)::integer,
    (array_agg(page.started_at order by page.started_at desc, page.id desc))[count(*)::integer],
    (array_agg(page.id order by page.started_at desc, page.id desc))[count(*)::integer]
  into attempt_payload, row_count, last_started_at, last_attempt_id
  from page;

  if row_count = requested_page_size and exists (
    select 1
    from public.attempts attempt
    where attempt.scheduled_challenge_id = target_scheduled_challenge_id
      and attempt.kind = 'competitive'
      and (attempt.started_at, attempt.id) < (last_started_at, last_attempt_id)
  ) then
    next_cursor := jsonb_build_object(
      'startedAt', last_started_at,
      'attemptId', last_attempt_id
    );
  end if;

  return jsonb_build_object(
    'publication', publication_payload,
    'attempts', attempt_payload,
    'nextCursor', next_cursor
  );
end;
$$;

create or replace function public.get_superadmin_attempt_inspection(
  target_room_id uuid,
  target_scheduled_challenge_id uuid,
  target_attempt_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  inspection_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'publication', jsonb_build_object(
      'scheduledChallengeId', schedule.id,
      'roomId', room.id,
      'roomTitle', room.title,
      'seasonId', season.id,
      'seasonTitle', season.title,
      'seasonStatus', season.status,
      'challengeVersionId', version.id,
      'challengeSlug', definition.slug,
      'versionNumber', version.version_number,
      'challengeTitle', version.title,
      'challengeSubtitle', version.subtitle,
      'mode', version.mode,
      'number', schedule.number,
      'status', schedule.status,
      'opensAt', schedule.opens_at,
      'closesAt', schedule.closes_at,
      'updatedAt', schedule.updated_at
    ),
    'attempt', jsonb_build_object(
      'attemptId', attempt.id,
      'playerId', attempt.player_id,
      'displayName', player.display_name,
      'avatarPath', player.avatar_path,
      'email', auth_user.email,
      'status', attempt.status,
      'outcome', attempt.outcome,
      'attemptNumber', attempt.attempt_number,
      'startedAt', attempt.started_at,
      'deadlineAt', attempt.deadline_at,
      'completedAt', attempt.completed_at,
      'originalScore', attempt.score,
      'effectiveScore', coalesce((select sum(entry.amount)::integer
        from private.flash_point_entries entry where entry.attempt_id = attempt.id), 0),
      'lockVersion', attempt.lock_version,
      'isCorrected', exists (select 1 from private.flash_point_entries entry
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'answer_regrade', 'reversal')),
      'terminalReason', attempt.terminal_reason
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'challengeItemId', item.id,
        'position', item.position,
        'itemPoints', item.points,
        'questionVersionId', question.id,
        'questionType', question.type,
        'publicPayload', question.public_payload,
        'answer', answer.answer,
        'status', answer.status,
        'effectiveStatus', coalesce(regrade.after_status, answer.status),
        'resultDetails', answer.result_details,
        'awardedPoints', answer.points,
        'effectiveAwardedPoints', coalesce(regrade.after_points, answer.points),
        'currentRubricVersionId', regrade.rubric_question_version_id,
        'availableRubrics', case when attempt.kind = 'competitive' and attempt.status = 'completed'
          and schedule.status <> 'cancelled' and question.type in ('short-text','progressive-image','progressive-clues')
          and answer.status in ('correct','partial','incorrect') and answer.submitted_at is not null
          and jsonb_typeof(answer.answer) = 'string' and (answer.answer #>> '{}') ~ '[^[:space:]]' then coalesce((
            select jsonb_agg(jsonb_build_object('questionVersionId', rubric.id, 'versionNumber', rubric.version_number)
              order by rubric.version_number desc)
            from private.question_versions rubric
            join private.question_version_solutions solution on solution.question_version_id = rubric.id
            where rubric.question_definition_id = question.question_definition_id
              and rubric.type = question.type and rubric.status = 'published'
              and private.valid_regrade_accepted_answers(solution.solution_payload->'acceptedAnswers')
          ), '[]'::jsonb) else '[]'::jsonb end,
        'presentedAt', answer.presented_at,
        'submittedAt', answer.submitted_at,
        'timeUsedMs', answer.time_used_ms
      ) order by item.position)
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      left join private.attempt_answers answer
        on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
      left join lateral (
        select correction.after_status, correction.after_points, correction.rubric_question_version_id
        from private.attempt_answer_regrades correction
        where correction.attempt_id = attempt.id and correction.challenge_item_id = item.id
        order by correction.attempt_lock_version desc
        limit 1
      ) regrade on true
      where item.challenge_version_id = attempt.challenge_version_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', entry.id,
        'entryType', entry.entry_type,
        'amount', entry.amount,
        'reason', entry.reason,
        'createdByPlayerId', entry.created_by_player_id,
        'createdByDisplayName', creator.display_name,
        'createdAt', entry.created_at
      ) order by entry.created_at, entry.id)
      from private.flash_point_entries entry
      left join public.players creator on creator.id = entry.created_by_player_id
      where entry.attempt_id = attempt.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'auditId', audit.id,
        'action', audit.action,
        'entityType', audit.entity_type,
        'entityId', audit.entity_id,
        'reason', audit.reason,
        'requestId', audit.request_id,
        'actorPlayerId', audit.actor_player_id,
        'actorDisplayName', audit_actor.display_name,
        'beforePayload', coalesce(audit.before_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'afterPayload', coalesce(audit.after_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'createdAt', audit.created_at
      ) order by audit.created_at, audit.id)
      from private.audit_log audit
      left join public.players audit_actor on audit_actor.id = audit.actor_player_id
      where audit.entity_type = 'attempt' and audit.entity_id = attempt.id
    ), '[]'::jsonb)
  )
  into inspection_payload
  from public.attempts attempt
  join public.players player on player.id = attempt.player_id
  left join auth.users auth_user on auth_user.id = player.auth_user_id
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where attempt.id = target_attempt_id
    and attempt.scheduled_challenge_id = target_scheduled_challenge_id
    and attempt.kind = 'competitive'
    and room.id = target_room_id
    and room.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial');

  return inspection_payload;
end;
$$;

commit;
