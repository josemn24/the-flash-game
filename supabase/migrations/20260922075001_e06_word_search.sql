SET local check_function_bodies = off;

CREATE TABLE "private"."word_search_selection_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             integer                  NOT NULL,
  "start_cell"           integer                  NOT NULL,
  "end_cell"             integer                  NOT NULL,
  "matched_target_id"    text,
  "correct"              boolean                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "word_search_selection_events_attempt_id_challenge_item_id_s_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "word_search_selection_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "word_search_selection_events_check1" CHECK ((start_cell <> end_cell)),
  CONSTRAINT "word_search_selection_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "word_search_selection_events_end_cell_check" CHECK ((end_cell >= 0)),
  CONSTRAINT "word_search_selection_events_id_attempt_id_challenge_item_i_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "word_search_selection_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "word_search_selection_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "word_search_selection_events_sequence_check" CHECK ((sequence > 0)),
  CONSTRAINT "word_search_selection_events_start_cell_check" CHECK ((start_cell >= 0)),
  CONSTRAINT "word_search_selection_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."word_search_selection_events"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.execute_command (
  op    text,
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  received timestamptz := clock_timestamp();
  instant timestamptz;
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  member public.room_memberships%rowtype;
  invitation private.room_invitations%rowtype;
  unit private.attempt_timing_units%rowtype;
  segment private.interaction_intervals%rowtype;
  receipt private.answer_receipts%rowtype;
  session_row private.attempt_sessions%rowtype;
  item private.challenge_items%rowtype;
  result jsonb;
  previous jsonb;
  allowed text[];
  required text[];
  target uuid;
  expected bigint;
  points integer;
  balance integer;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  resumed boolean := false;
  control_required boolean := false;
  is_admin boolean;
  target_status text;
begin
  case op
    when 'start' then
      allowed := array['idempotencyKey','scheduledChallengeId','sessionToken']; required := allowed;
    when 'takeover' then
      allowed := array['idempotencyKey','attemptId','lockVersion','newSessionToken']; required := allowed;
    when 'prepare' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'receive' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer'];
      allowed := required || array['clientTimeUsedMs'];
    when 'pass' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']; required := allowed;
    when 'evaluate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','receiptId','status','points'];
      allowed := required || array['resultDetails'];
    when 'complete' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','score'];
      allowed := required || array['outcome'];
    when 'abandon' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'accept_invitation' then
      allowed := array['idempotencyKey','invitationToken']; required := allowed;
    when 'invalidate' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason']; required := allowed;
    when 'adjust' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason','score']; required := allowed;
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
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> op or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if op = 'accept_invitation' then
    -- Room before invitation/membership is the shared lock order for membership writers.
    select room_id into target from private.room_invitations where token_hash = safe_input->>'invitationToken';
    perform 1 from public.rooms where id = target and status = 'active' for update;
    if not found then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    select * into invitation from private.room_invitations where token_hash = safe_input->>'invitationToken' for update;
    select * into member from public.room_memberships where room_id = target and player_id = actor for update;
    if member.status = 'banned' then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    if cached.result is not null then return cached.result; end if;
    if invitation.revoked_at is not null or invitation.expires_at <= clock_timestamp()
      or (invitation.max_uses is not null and invitation.use_count >= invitation.max_uses) then
      raise exception 'invitation_unavailable' using errcode = '42501';
    end if;
    if member.status = 'active' then
      result := jsonb_build_object('membershipId', member.id, 'joined', false);
    else
      insert into public.room_memberships(room_id, player_id, role) values(target, actor, invitation.role)
      on conflict (room_id, player_id) do update set status = 'active', ended_at = null,
        joined_at = clock_timestamp(), role = excluded.role returning * into member;
      update private.room_invitations set use_count = use_count + 1 where id = invitation.id;
      result := jsonb_build_object('membershipId', member.id, 'joined', true);
    end if;
    target := invitation.id;
  elsif op = 'start' then
    target := (input->>'scheduledChallengeId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
    if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = target for share;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
    if cached.result is not null then return cached.result; end if;
    if found then
      if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
      resumed := true;
      select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
      control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
    else
      insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
      values(actor, target, sc.challenge_version_id, 'competitive', 1)
      returning * into a;
      insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
        values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
    end if;
    target := a.id;
    result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
      'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op not in ('invalidate','adjust') then
      if a.player_id <> actor or a.kind <> 'competitive' or is_admin or not exists (
        select 1 from public.seasons s join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id
        where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
          and m.status = 'active' and m.role in ('owner','admin','member')
      ) then raise exception 'not_authorized' using errcode = '42501'; end if;
      if op <> 'takeover' then
        select * into session_row from private.attempt_sessions where attempt_id = a.id
          and session_token_hash = safe_input->>'sessionToken';
        if not found or (session_row.revoked_at is not null and not (
          op in ('complete','abandon') and cached.result is not null and a.status in ('completed','abandoned')
        )) then raise exception 'session_revoked' using errcode = '42501'; end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached.result is not null then return cached.result; end if;
    expected := (input->>'lockVersion')::bigint;
    if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
    if op not in ('invalidate','adjust') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        if a.deadline_at is not null and instant >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
          values(a.id, safe_input->>'newSessionToken', a.deadline_at) returning * into session_row;
        result := jsonb_build_object('sessionId', session_row.id, 'deadlineAt', a.deadline_at);
      when 'prepare' then
        if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id and not exists (
          select 1 from private.attempt_answers aa where aa.receipt_id = r.id
        )) then raise exception 'evaluation_pending' using errcode = '55000'; end if;
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if found then
          select * into item from private.challenge_items where id = segment.challenge_item_id;
          select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        else
          select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
          if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
          select * into unit from private.attempt_timing_units where attempt_id = a.id and challenge_item_id = item.id;
          if not found then
            insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
            select a.id, a.challenge_version_id, item.id,
              case cv.mode when 'alphabet' then 'attempt' when 'pyramid' then 'level' else 'question' end,
              case when cv.mode = 'alphabet' then a.started_at else instant end,
              case when cv.mode = 'alphabet' then a.deadline_at else instant + q.time_limit_ms * interval '1 millisecond' end
            from private.question_versions q where q.id = item.question_version_id returning * into unit;
          end if;
          insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
            values(a.id, item.id, unit.id, least(instant, unit.deadline_at)) returning * into segment;
        end if;
        perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
        select jsonb_build_object('challengeItemId', item.id, 'questionType', q.type,
          'payloadSchemaVersion', q.payload_schema_version,
          'publicPayload', case
            when instant >= unit.deadline_at then null
            when q.type = 'progressive-clues' then private.progressive_clues_public_payload(item.id)
            when q.type = 'matching' then private.matching_public_payload(item.id)
            else q.public_payload
          end,
          'presentedAt', segment.started_at, 'deadlineAt', unit.deadline_at, 'timedOut', instant >= unit.deadline_at,
          'progress', case
            when q.type = 'mini-wordle' then private.mini_wordle_progress(a.id, item.id)
            when q.type = 'logic-code' then private.logic_code_progress(a.id, item.id)
            when q.type = 'progressive-clues' then private.progressive_clues_progress(a.id, item.id)
            when q.type = 'matching' then private.matching_progress(a.id, item.id)
            when q.type = 'queens' then private.queens_progress(a.id, item.id)
            when q.type = 'word-search' then private.word_search_progress(a.id, item.id)
            when q.type = 'short-text' and cv.mode = 'alphabet' then (
              select jsonb_build_object(
                'kind', 'alphabet',
                'round', greatest(1, 1 + floor((
                  (select count(*) from private.interaction_intervals interval_row
                    where interval_row.attempt_id = a.id)::numeric /
                  nullif((select count(*) from private.challenge_items round_item
                    where round_item.challenge_version_id = a.challenge_version_id)::numeric, 0)
                ))::integer),
                'currentIndex', item.position - 1,
                'playedCount', (select count(distinct interval_row.challenge_item_id)::integer
                  from private.interaction_intervals interval_row
                  where interval_row.attempt_id = a.id),
                'correctAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'incorrectAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'incorrect'),
                'elapsedTimeMs', coalesce((select sum(floor(extract(epoch from
                  (interval_row.ended_at - interval_row.started_at)) * 1000))::bigint
                  from private.interaction_intervals interval_row where interval_row.attempt_id = a.id), 0)::bigint,
                'deadlineAt', a.deadline_at,
                'lastCorrectAt', (select max(answer_row.submitted_at) from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'letters', coalesce((select jsonb_agg(jsonb_build_object(
                  'letter', all_item.mode_config->>'letter',
                  'challengeItemId', all_item.id,
                  'status', case
                    when answer_row.status is not null then answer_row.status
                    when exists (select 1 from private.interaction_intervals open_interval
                      where open_interval.attempt_id = a.id and open_interval.challenge_item_id = all_item.id
                        and open_interval.ended_at is null) then 'active'
                    when exists (select 1 from private.interaction_intervals visited
                      where visited.attempt_id = a.id and visited.challenge_item_id = all_item.id) then 'passed'
                    else 'unvisited' end,
                  'answer', case when answer_row.answer is null then null
                    else answer_row.answer #>> '{}' end
                ) order by all_item.position)
                  from private.challenge_items all_item
                  left join private.attempt_answers answer_row
                    on answer_row.attempt_id = a.id and answer_row.challenge_item_id = all_item.id
                  where all_item.challenge_version_id = a.challenge_version_id), '[]'::jsonb)
              )
            )
            else null end)
          into result from private.question_versions q where q.id = item.question_version_id;
      when 'receive', 'pass' then
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
          raise exception 'interaction_not_presented' using errcode = '55000';
        end if;
        select * into item from private.challenge_items where id = segment.challenge_item_id;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'mini-wordle'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'logic-code'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'queens'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'queens_requires_placement_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'matching'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'matching_requires_pair_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'word-search'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'word_search_requires_selection_command' using errcode = '22023';
        end if;
        select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
        if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
        late := received >= unit.deadline_at;
        effective := least(received, unit.deadline_at);
        if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
        update private.interaction_intervals set ended_at = effective,
          end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
        if op = 'pass' then result := jsonb_build_object('passed', true);
        else
          select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
            into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
          insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
            received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
          values(a.id, segment.challenge_item_id, a.challenge_version_id, input->'answer', received, presented,
            effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
          result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
            'receivedAt', received, 'presentedAt', presented);
        end if;
      when 'evaluate' then
        select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
          raise exception 'already_evaluated' using errcode = '55000';
        end if;
        -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
          status, answer, result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
          input->>'status', receipt.answer, input->'resultDetails', (input->>'points')::integer,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
        result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status', 'points', (input->>'points')::integer);
      when 'complete', 'abandon' then
        if op = 'complete' then
          if exists (select 1 from private.interaction_intervals where attempt_id = a.id and ended_at is null)
            or exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
              and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
            raise exception 'unfinished_interaction' using errcode = '55000';
          end if;
          if not exists (select 1 from private.attempt_answers where attempt_id = a.id) then
            raise exception 'no_evaluated_answers' using errcode = '55000';
          end if;
          if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
            raise exception 'incomplete_challenge' using errcode = '55000';
          end if;
          -- Mode evaluator decides early termination in survival/pyramid and normalized final score.
          points := (input->>'score')::integer;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        update public.attempts set status = target_status, score = points, completed_at = instant,
          outcome = input->>'outcome', progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        if op = 'complete' then
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
        end if;
        result := jsonb_build_object('status', a.status, 'score', a.score);
      when 'invalidate', 'adjust' then
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
          points := (input->>'score')::integer;
          if points not between 0 and 100 then raise exception 'invalid_score' using errcode = '22023'; end if;
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
            amount, reason, created_by_player_id, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'adjustment', points - balance, input->>'reason', actor, 'adjust:' || actor || ':' || key);
          update public.attempts set lock_version = lock_version + 1 where id = a.id returning * into a;
          -- Corrections preserve the immutable original score/status.
          result := jsonb_build_object('status', a.status, 'effectiveScore', points);
        end if;
    end case;
    if op not in ('complete','abandon','invalidate','adjust') then
      update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, op, case when op = 'accept_invitation' then 'invitation' else 'attempt' end,
    target, input->>'reason', key, previous,
    -- Avoid persisting playable payloads or free-text answers into a second store.
    result - 'publicPayload');
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, op, safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_evaluation_context (
  target_receipt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'receiptId', r.id, 'answer', case when q.type = 'matching' then coalesce((
      select jsonb_object_agg(e.left_item_id, e.right_item_id)
      from private.matching_pair_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '{}'::jsonb) when q.type = 'queens' then private.queens_answer(r.attempt_id, r.challenge_item_id) when q.type = 'word-search' then coalesce((
      select jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '[]'::jsonb) else r.answer end, 'receivedAt', r.received_at,
    'timeUsedMs', r.time_used_ms, 'timedOut', r.timed_out,
    'questionType', q.type, 'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', q.public_payload,
    'submittedCodes', case when q.type = 'logic-code' then coalesce((
      select jsonb_agg(e.code order by e.sequence)
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), '[]'::jsonb) else null end,
    'progressiveCluesRevealed', case when q.type = 'progressive-clues' then coalesce((
      select max(e.clue_index)::integer
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), 1) else null end,
    'matchingIncorrectAttempts', case when q.type = 'matching' then coalesce((
      select count(*)::integer from private.matching_pair_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'incorrectAttempts', case when q.type = 'logic-code' then coalesce((
      select count(*)::integer
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) when q.type = 'queens' then coalesce((
      select count(*)::integer
      from private.queens_placement_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.penalty_applied
    ), 0) when q.type = 'word-search' then coalesce((
      select count(*)::integer from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'solutionPayload', qs.solution_payload, 'timeLimitMs', q.time_limit_ms,
    'itemPoints', i.points, 'itemConfigSchemaVersion', i.config_schema_version,
    'itemConfig', i.mode_config, 'mode', cv.mode,
    'modeConfigSchemaVersion', cv.config_schema_version, 'modeConfig', cv.mode_config)
  into result from private.answer_receipts r
  join public.attempts a on a.id = r.attempt_id
  join private.attempt_sessions s on s.attempt_id = a.id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = actor
  join private.challenge_items i on i.id = r.challenge_item_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  where r.id = target_receipt and a.player_id = actor and a.status = 'in_progress'
    and a.kind = 'competitive' and sc.status <> 'cancelled' and room.status = 'active'
    and m.status = 'active' and m.role in ('owner', 'admin', 'member')
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_word_search_selection (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.validate_flash_editorial_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  challenge jsonb;
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  option_count integer;
  seen_question_versions text[] := array[]::text[];
  expected_word_length integer;
  max_attempts integer;
  code_length integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
  grid_rows integer;
  grid_columns integer;
  target_id text;
  target_word text;
  target_pos jsonb;
  start_cell_i integer;
  end_cell_i integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  row_step_i integer;
  col_step_i integer;
  word_length_i integer;
  path_cell_i integer;
  path_offset_i integer;
  occurrence_count_i integer;
  candidate_word text;
  candidate_segment text;
  target_segment text;
  check_start integer;
  direction_row integer;
  direction_col integer;
  cell_row integer;
  cell_col integer;
  seen_ids text[] := array[]::text[];
  seen_words text[] := array[]::text[];
  seen_segments text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object'
    or not document ?& array['challenge', 'questions']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['challenge', 'questions'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  challenge := document->'challenge';
  if jsonb_typeof(challenge) is distinct from 'object'
    or not challenge ?& array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig']
    or exists (
      select 1 from jsonb_object_keys(challenge) key_name
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig', 'globalTimeLimitMs'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' not in ('flash', 'alphabet')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' = 'alphabet' and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' = 'flash' and challenge ? 'globalTimeLimitMs') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or jsonb_array_length(document->'questions') not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if jsonb_typeof(question) = 'object' and question->>'source' = 'library' then
      if exists (
          select 1 from jsonb_object_keys(question) key_name
          where key_name <> all(array['source', 'questionVersionId', 'points', 'modeConfig', 'challengeItemId'])
        )
        or not question ?& array['source', 'questionVersionId', 'points', 'modeConfig']
        or jsonb_typeof(question->'questionVersionId') is distinct from 'string'
        or question->>'questionVersionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(question->'points') is distinct from 'number'
        or (question->>'points')::numeric <> trunc((question->>'points')::numeric)
        or (question->>'points')::integer <= 0
        or (question->>'points')::integer > 100
        or jsonb_typeof(question->'modeConfig') is distinct from 'object'
        or (question ? 'challengeItemId' and (
          jsonb_typeof(question->'challengeItemId') is distinct from 'string'
          or question->>'challengeItemId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or question->>'questionVersionId' = any(seen_question_versions) then
        raise exception 'invalid_question_reference' using errcode = '22023';
      end if;
      seen_question_versions := seen_question_versions || (question->>'questionVersionId');
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload'])
      ) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    question_slug := btrim(question->>'slug');
    if jsonb_typeof(question->'slug') is distinct from 'string'
      or char_length(question_slug) not between 1 and 120
      or question->>'type' not in ('multiple-choice', 'estimation', 'heat-map', 'mini-wordle', 'logic-code', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'true-false', 'odd-one-out', 'ordering', 'anagram', 'classification', 'short-text', 'word-search')
      or (question->>'type' not in ('progressive-image', 'multiple-choice', 'estimation', 'heat-map') and question->'payloadSchemaVersion' <> '1'::jsonb)
      or (question->>'type' in ('progressive-image', 'multiple-choice') and question->'payloadSchemaVersion' not in ('1'::jsonb, '2'::jsonb))
      or (question->>'type' in ('estimation', 'heat-map') and question->'payloadSchemaVersion' <> '2'::jsonb)
      or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
      or (question->>'timeLimitMs')::numeric <= 0
      or question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_typeof(question->'points') is distinct from 'number' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    question_points := (question->>'points')::numeric;
    if question_points <> trunc(question_points)
      or question_points <= 0
      or question_points > 100 then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    total_points := total_points + question_points::integer;
    seen_slugs := seen_slugs || question_slug;

    public_payload := question->'publicPayload';
    solution_payload := question->'solutionPayload';

    if question->>'type' = 'estimation' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'min', 'max', 'step', 'initialValue', 'unit', 'media']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'min', 'max', 'step', 'initialValue', 'unit', 'media'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'min') is distinct from 'number'
        or jsonb_typeof(public_payload->'max') is distinct from 'number'
        or jsonb_typeof(public_payload->'step') is distinct from 'number'
        or jsonb_typeof(public_payload->'initialValue') is distinct from 'number'
        or (public_payload->>'min')::numeric >= (public_payload->>'max')::numeric
        or (public_payload->>'step')::numeric <= 0
        or (public_payload->>'initialValue')::numeric < (public_payload->>'min')::numeric
        or (public_payload->>'initialValue')::numeric > (public_payload->>'max')::numeric
        or abs(
          ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
          (public_payload->>'step')::numeric - round(
            ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
            (public_payload->>'step')::numeric
          )
        ) > 0.000000001
        or jsonb_typeof(public_payload->'unit') is distinct from 'string'
        or char_length(btrim(public_payload->>'unit')) not between 1 and 120
        or jsonb_typeof(public_payload->'media') not in ('null', 'object')
        or (jsonb_typeof(public_payload->'media') = 'object' and (
          not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
          or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
            'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
          ]))
          or public_payload->'media'->>'type' <> 'image'
          or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
          or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
          or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
          or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
          or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
          or (public_payload->'media'->>'width')::integer not between 1 and 8192
          or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
          or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
          or (public_payload->'media'->>'height')::integer not between 1 and 8192
          or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
          or (public_payload->'media' ? 'position' and (
            jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
            or char_length(public_payload->'media'->>'position') > 100
          ))
        )) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'tolerance']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'tolerance', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'number'
        or (solution_payload->>'correctAnswer')::numeric < (public_payload->>'min')::numeric
        or (solution_payload->>'correctAnswer')::numeric > (public_payload->>'max')::numeric
        or jsonb_typeof(solution_payload->'tolerance') is distinct from 'number'
        or (solution_payload->>'tolerance')::numeric < 0
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'heat-map' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'targetLabel']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'targetLabel'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'targetLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'targetLabel')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer not between 1 and 8192
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (
          jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100
        )) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['target', 'fullCreditRadius', 'toleranceRadius']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'target', 'fullCreditRadius', 'toleranceRadius', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'target') is distinct from 'object'
        or not solution_payload->'target' ?& array['x', 'y']
        or exists (select 1 from jsonb_object_keys(solution_payload->'target') key_name where key_name <> all(array['x', 'y']))
        or jsonb_typeof(solution_payload->'target'->'x') is distinct from 'number'
        or (solution_payload->'target'->>'x')::numeric not between 0 and 1
        or jsonb_typeof(solution_payload->'target'->'y') is distinct from 'number'
        or (solution_payload->'target'->>'y')::numeric not between 0 and 1
        or jsonb_typeof(solution_payload->'fullCreditRadius') is distinct from 'number'
        or (solution_payload->>'fullCreditRadius')::numeric < 0
        or jsonb_typeof(solution_payload->'toleranceRadius') is distinct from 'number'
        or (solution_payload->>'toleranceRadius')::numeric <= (solution_payload->>'fullCreditRadius')::numeric
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'mini-wordle' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'wordLength', 'maxAttempts']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'hint', 'wordLength', 'maxAttempts'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'wordLength') is distinct from 'number'
        or (public_payload->>'wordLength')::integer not in (4, 5)
        or jsonb_typeof(public_payload->'maxAttempts') is distinct from 'number'
        or (public_payload->>'maxAttempts')::integer not between 1 and 10
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'additionalGuesses', 'dictionaryId']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'additionalGuesses', 'dictionaryId', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or jsonb_typeof(solution_payload->'additionalGuesses') is distinct from 'array'
        or jsonb_typeof(solution_payload->'dictionaryId') is distinct from 'string'
        or solution_payload->>'dictionaryId' not in ('es-general-4.v1', 'es-general-5.v1')
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      expected_word_length := (public_payload->>'wordLength')::integer;
      max_attempts := (public_payload->>'maxAttempts')::integer;
      selected_dictionary_id := solution_payload->>'dictionaryId';
      if (expected_word_length = 4 and selected_dictionary_id <> 'es-general-4.v1')
        or (expected_word_length = 5 and selected_dictionary_id <> 'es-general-5.v1')
        or char_length(private.mini_wordle_normalize(solution_payload->>'correctAnswer')) <> expected_word_length
        or private.mini_wordle_normalize(solution_payload->>'correctAnswer') !~ '^[A-ZÑ]+$'
        or jsonb_array_length(solution_payload->'additionalGuesses') > 1000
        or exists (select 1 from jsonb_array_elements(solution_payload->'additionalGuesses') extra
          where jsonb_typeof(extra) is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      solution_word := private.mini_wordle_normalize(solution_payload->>'correctAnswer');
      for guess_word in select value from jsonb_array_elements_text(solution_payload->'additionalGuesses') loop
        if char_length(private.mini_wordle_normalize(guess_word)) <> expected_word_length
          or private.mini_wordle_normalize(guess_word) !~ '^[A-ZÑ]+$'
          or private.mini_wordle_normalize(guess_word) = solution_word
          or (select count(*) from jsonb_array_elements_text(solution_payload->'additionalGuesses') values(value)
              where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(guess_word)) > 1 then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
      end loop;
      continue;
    end if;

    if question->>'type' = 'logic-code' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'codeLength']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'codeLength'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'codeLength') is distinct from 'number'
        or (public_payload->>'codeLength')::integer not between 1 and 12
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1
          from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'object'
            or not clue ?& array['code', 'hint']
            or exists (select 1 from jsonb_object_keys(clue) key_name where key_name <> all(array['code', 'hint']))
            or jsonb_typeof(clue->'code') is distinct from 'string'
            or char_length(clue->>'code') <> (public_payload->>'codeLength')::integer
            or clue->>'code' !~ '^[0-9]+$'
            or jsonb_typeof(clue->'hint') is distinct from 'string'
            or char_length(btrim(clue->>'hint')) not between 1 and 500
        )
        or (select count(distinct clue->>'code') from jsonb_array_elements(public_payload->'clues') clue)
           <> jsonb_array_length(public_payload->'clues') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(solution_payload->>'correctAnswer') <> (public_payload->>'codeLength')::integer
        or solution_payload->>'correctAnswer' !~ '^[0-9]+$'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-clues' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'clues', 'cluePenalty']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'clues', 'cluePenalty'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'clues') is distinct from 'array'
        or jsonb_array_length(public_payload->'clues') not between 1 and 20
        or jsonb_typeof(public_payload->'cluePenalty') is distinct from 'number'
        or (public_payload->>'cluePenalty')::numeric <> trunc((public_payload->>'cluePenalty')::numeric)
        or (public_payload->>'cluePenalty')::integer not between 0 and 50
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'clues') clue
          where jsonb_typeof(clue) is distinct from 'string'
            or char_length(btrim(clue #>> '{}')) not between 1 and 500
        ) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (
          select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500
        )
        or exists (
          select 1
          from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1
        )
        or not exists (
          select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'true-false' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ? 'question'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'boolean'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'odd-one-out' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 3 and 8
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'items') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or not exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where item->>'id' = solution_payload->>'correctAnswer'
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'ordering' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items', 'directionLabels'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 2 and 8
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'string'
            or char_length(btrim(item #>> '{}')) not between 1 and 500
        )
        or exists (select 1 from (
          select value from jsonb_array_elements_text(public_payload->'items') group by value having count(*) > 1
        ) duplicate_item)
        or (public_payload ? 'directionLabels' and jsonb_typeof(public_payload->'directionLabels') not in ('null', 'object'))
        or (jsonb_typeof(public_payload->'directionLabels') = 'object' and (
          exists (select 1 from jsonb_object_keys(public_payload->'directionLabels') key_name where key_name not in ('start', 'end'))
          or not (public_payload->'directionLabels' ?& array['start', 'end'])
          or jsonb_typeof(public_payload->'directionLabels'->'start') is distinct from 'string'
          or char_length(btrim(public_payload->'directionLabels'->>'start')) not between 1 and 120
          or jsonb_typeof(public_payload->'directionLabels'->'end') is distinct from 'string'
          or char_length(btrim(public_payload->'directionLabels'->>'end')) not between 1 and 120
        ))
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctOrder'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctOrder', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctOrder') is distinct from 'array'
        or jsonb_array_length(solution_payload->'correctOrder') <> jsonb_array_length(public_payload->'items')
        or exists (
          select 1 from jsonb_array_elements(solution_payload->'correctOrder') item
          where jsonb_typeof(item) is distinct from 'string'
        )
        or exists (
          select 1 from jsonb_array_elements_text(solution_payload->'correctOrder') item
          where not exists (select 1 from jsonb_array_elements_text(public_payload->'items') public_item where public_item = item)
        )
        or (select count(*) from jsonb_array_elements_text(solution_payload->'correctOrder')) <> (
          select count(distinct value) from jsonb_array_elements_text(solution_payload->'correctOrder') value
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'anagram' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'tiles']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'tiles', 'hint'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'tiles') is distinct from 'array'
        or jsonb_array_length(public_payload->'tiles') not between 3 and 10
        or exists (
          select 1 from jsonb_array_elements(public_payload->'tiles') tile
          where jsonb_typeof(tile) is distinct from 'object'
            or not tile ?& array['id', 'value']
            or exists (select 1 from jsonb_object_keys(tile) key_name where key_name <> all(array['id', 'value']))
            or jsonb_typeof(tile->'id') is distinct from 'string'
            or char_length(btrim(tile->>'id')) not between 1 and 120
            or jsonb_typeof(tile->'value') is distinct from 'string'
            or char_length(tile->>'value') <> 1
            or char_length(btrim(tile->>'value')) <> 1
        )
        or exists (select 1 from (
          select tile->>'id' as id from jsonb_array_elements(public_payload->'tiles') tile
          group by tile->>'id' having count(*) > 1
        ) duplicate_id)
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
        or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') = 'string' and char_length(public_payload->>'hint') > 500) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'correctAnswer'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 3 and 120
        or solution_payload->>'correctAnswer' ~ '\s'
        or char_length(solution_payload->>'correctAnswer') <> jsonb_array_length(public_payload->'tiles')
        or (select string_agg(lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
            from jsonb_array_elements(public_payload->'tiles') tile) <>
          (select string_agg(lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
            from regexp_split_to_table(solution_payload->>'correctAnswer', '') letter)
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'classification' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'items', 'categories']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'items', 'categories'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'items') is distinct from 'array'
        or jsonb_array_length(public_payload->'items') not between 2 and 20
        or jsonb_typeof(public_payload->'categories') is distinct from 'array'
        or jsonb_array_length(public_payload->'categories') not between 2 and 8
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ? 'label'
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> 'label')
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
        )
        or exists (select 1 from (
          select item->>'label' as label from jsonb_array_elements(public_payload->'items') item
          group by item->>'label' having count(*) > 1
        ) duplicate_label)
        or exists (
          select 1 from jsonb_array_elements(public_payload->'categories') category
          where jsonb_typeof(category) is distinct from 'string'
            or char_length(btrim(category #>> '{}')) not between 1 and 120
        )
        or exists (select 1 from (
          select value from jsonb_array_elements_text(public_payload->'categories') group by value having count(*) > 1
        ) duplicate_category) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'categoriesByItem'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'categoriesByItem', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'categoriesByItem') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'categoriesByItem')) <> jsonb_array_length(public_payload->'items')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'items') item
          where not (solution_payload->'categoriesByItem' ? (item->>'label'))
            or jsonb_typeof(solution_payload->'categoriesByItem'->(item->>'label')) is distinct from 'string'
            or not exists (
              select 1 from jsonb_array_elements_text(public_payload->'categories') category
              where category = solution_payload->'categoriesByItem'->>(item->>'label')
            )
        )
        or exists (
          select 1 from jsonb_object_keys(solution_payload->'categoriesByItem') key_name
          where not exists (select 1 from jsonb_array_elements(public_payload->'items') item where item->>'label' = key_name)
        )
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'matching' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'leftItems', 'rightItems']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'leftItems', 'rightItems'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'leftItems') is distinct from 'array'
        or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
        or jsonb_array_length(public_payload->'leftItems') not between 3 and 6
        or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or exists (
          select 1 from jsonb_array_elements(public_payload->'leftItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'label']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'label') is distinct from 'string'
            or char_length(btrim(item->>'label')) not between 1 and 500
            or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
            or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
        )
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item
          group by item->>'id' having count(*) > 1
        ) duplicate_id)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'leftItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate)
        or exists (select 1 from (
          select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
          from jsonb_array_elements(public_payload->'rightItems') item
          group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
        ) duplicate) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'matches'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches', 'explanation']))
        or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
        or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
        or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
        or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (
          select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value
        ))
        or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'word-search' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'grid', 'letters', 'targets']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'grid', 'letters', 'targets'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or jsonb_typeof(public_payload->'grid') is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
        or not public_payload->'grid' ?& array['rows', 'columns']
        or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
        or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
        or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
        or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
        or (public_payload->'grid'->>'rows')::integer not between 6 and 10
        or (public_payload->'grid'->>'columns')::integer not between 6 and 10
        or jsonb_typeof(public_payload->'letters') is distinct from 'array'
        or jsonb_array_length(public_payload->'letters') <> (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer
        or exists (select 1 from jsonb_array_elements_text(public_payload->'letters') letter
          where char_length(upper(btrim(letter))) <> 1 or upper(btrim(letter)) !~ '^[A-ZÁÉÍÓÚÜÑ]$')
        or jsonb_typeof(public_payload->'targets') is distinct from 'array'
        or jsonb_array_length(public_payload->'targets') not between 2 and 8
        or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
          where jsonb_typeof(item) is distinct from 'object'
            or not item ?& array['id', 'word']
            or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'word']))
            or jsonb_typeof(item->'id') is distinct from 'string'
            or char_length(btrim(item->>'id')) not between 1 and 120
            or jsonb_typeof(item->'word') is distinct from 'string'
            or char_length(btrim(item->>'word')) not between 1 and 120
            or upper(btrim(item->>'word')) !~ '^[A-ZÁÉÍÓÚÜÑ]+$')
        or exists (select 1 from (
          select btrim(item->>'id') value from jsonb_array_elements(public_payload->'targets') item
          group by btrim(item->>'id') having count(*) > 1
        ) duplicate)
        or exists (select 1 from (
          select upper(btrim(item->>'word')) value from jsonb_array_elements(public_payload->'targets') item
          group by upper(btrim(item->>'word')) having count(*) > 1
        ) duplicate) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ? 'positionsByTargetId'
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['positionsByTargetId', 'explanation']))
        or jsonb_typeof(solution_payload->'positionsByTargetId') is distinct from 'object'
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
        or (select count(*) from jsonb_object_keys(solution_payload->'positionsByTargetId')) <> jsonb_array_length(public_payload->'targets')
        or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
          where not solution_payload->'positionsByTargetId' ? (item->>'id')) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;

      grid_rows := (public_payload->'grid'->>'rows')::integer;
      grid_columns := (public_payload->'grid'->>'columns')::integer;
      for target_id, target_word in
        select btrim(item->>'id'), upper(btrim(item->>'word'))
        from jsonb_array_elements(public_payload->'targets') item
      loop
        target_pos := solution_payload->'positionsByTargetId'->target_id;
        if jsonb_typeof(target_pos) is distinct from 'object'
          or not target_pos ?& array['startCell', 'endCell']
          or exists (select 1 from jsonb_object_keys(target_pos) key_name where key_name <> all(array['startCell', 'endCell']))
          or jsonb_typeof(target_pos->'startCell') is distinct from 'number'
          or jsonb_typeof(target_pos->'endCell') is distinct from 'number'
          or (target_pos->>'startCell')::numeric <> trunc((target_pos->>'startCell')::numeric)
          or (target_pos->>'endCell')::numeric <> trunc((target_pos->>'endCell')::numeric) then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        start_cell_i := (target_pos->>'startCell')::integer;
        end_cell_i := (target_pos->>'endCell')::integer;
        start_row_i := floor(start_cell_i / grid_columns);
        start_col_i := start_cell_i % grid_columns;
        end_row_i := floor(end_cell_i / grid_columns);
        end_col_i := end_cell_i % grid_columns;
        if start_cell_i not between 0 and grid_rows * grid_columns - 1
          or end_cell_i not between 0 and grid_rows * grid_columns - 1
          or start_cell_i = end_cell_i
          or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        word_length_i := char_length(target_word);
        if array_length(seen_ids, 1) is not null and target_id = any(seen_ids)
          or array_length(seen_words, 1) is not null and target_word = any(seen_words) then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        seen_ids := seen_ids || target_id;
        seen_words := seen_words || target_word;
        target_segment := least(start_cell_i, end_cell_i)::text || ':' || greatest(start_cell_i, end_cell_i)::text;
        if array_length(seen_segments, 1) is not null and target_segment = any(seen_segments) then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        seen_segments := seen_segments || target_segment;
        row_step_i := sign(end_row_i - start_row_i);
        col_step_i := sign(end_col_i - start_col_i);
        candidate_word := '';
        for path_offset_i in 0..word_length_i - 1 loop
          path_cell_i := (start_row_i + row_step_i * path_offset_i) * grid_columns + start_col_i + col_step_i * path_offset_i;
          if path_cell_i < 0 or path_cell_i >= grid_rows * grid_columns then
            raise exception 'invalid_solution_payload' using errcode = '22023';
          end if;
          candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
        end loop;
        if candidate_word <> target_word then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;

        occurrence_count_i := 0;
        for check_start in 0..grid_rows * grid_columns - 1 loop
          for direction_row in -1..1 loop
            for direction_col in -1..1 loop
              if direction_row = 0 and direction_col = 0 then continue; end if;
              candidate_word := '';
              candidate_segment := null;
              for path_offset_i in 0..word_length_i - 1 loop
                cell_row := floor(check_start / grid_columns) + direction_row * path_offset_i;
                cell_col := (check_start % grid_columns) + direction_col * path_offset_i;
                if cell_row < 0 or cell_row >= grid_rows or cell_col < 0 or cell_col >= grid_columns then
                  candidate_word := null;
                  exit;
                end if;
                path_cell_i := cell_row * grid_columns + cell_col;
                candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
              end loop;
              if candidate_word = target_word then
                candidate_segment := least(check_start, path_cell_i)::text || ':' || greatest(check_start, path_cell_i)::text;
                occurrence_count_i := occurrence_count_i + 1;
                if candidate_segment = target_segment then
                  -- Both directions describe one undirected occurrence.
                  occurrence_count_i := occurrence_count_i - 1;
                end if;
              end if;
            end loop;
          end loop;
        end loop;
        if occurrence_count_i <> 0 then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
      end loop;
      continue;
    end if;

    if question->>'type' = 'queens' then
      if exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name not in ('category', 'tags', 'question', 'grid', 'regions', 'prefilledQueens'))
        or private.editorial_has_secret_key(public_payload)
        or not private.queens_content_valid(public_payload, solution_payload)
        or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
        or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'progressive-image' then
      if question->>'payloadSchemaVersion' = '2' then
        if jsonb_typeof(public_payload) is distinct from 'object'
          or not public_payload ?& array['question', 'surface', 'revealDurationMs']
          or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
            'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
          ]))
          or private.editorial_has_secret_key(public_payload)
          or jsonb_typeof(public_payload->'surface') is distinct from 'object'
          or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
          or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
            'assetId', 'alt', 'width', 'height', 'fit', 'position'
          ]))
          or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
          or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
          or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
          or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
          or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
          or (public_payload->'surface'->>'width')::integer not between 1 and 8192
          or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
          or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
          or (public_payload->'surface'->>'height')::integer not between 1 and 8192
          or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
          or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
            or char_length(public_payload->'surface'->>'position') > 100))
          or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
          or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
          or (public_payload->>'revealDurationMs')::integer <= 0
          or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
          or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
          or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
          raise exception 'invalid_public_payload' using errcode = '22023';
        end if;
      else
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'revealDurationMs']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['src', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'src', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or jsonb_typeof(public_payload->'surface'->'src') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'src')) not between 10 and 1000
        or left(public_payload->'surface'->>'src', 9) <> '/visuals/'
        or public_payload->'surface'->>'src' ~ '\s'
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer <= 0
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer <= 0
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100))
        or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
        or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
        or (public_payload->>'revealDurationMs')::integer <= 0
        or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
        or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
      end if;
      if jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers', 'solutionAlt']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'solutionAlt', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
          having count(*) > 1)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'))
        or position(
          regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') in
          regexp_replace(lower(translate(btrim(public_payload->'surface'->>'alt'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        ) > 0
        or jsonb_typeof(solution_payload->'solutionAlt') is distinct from 'string'
        or char_length(btrim(solution_payload->>'solutionAlt')) not between 1 and 500
        or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if question->>'type' = 'short-text' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ? 'question'
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'question') is distinct from 'string'
        or char_length(btrim(public_payload->>'question')) not between 1 and 2000
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string'))
        or jsonb_typeof(solution_payload) is distinct from 'object'
        or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
        or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
          'correctAnswer', 'acceptedAnswers', 'explanation'
        ]))
        or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
        or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
        or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
        or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
        or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
          where jsonb_typeof(answer) is distinct from 'string'
            or char_length(btrim(answer #>> '{}')) not between 1 and 500)
        or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
          where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\\s+', '', 'g') =
            regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\\s+', '', 'g')) then
        raise exception 'invalid_short_text_payload' using errcode = '22023';
      end if;
      continue;
    end if;

    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'options']
      or exists (
        select 1 from jsonb_object_keys(public_payload) key_name
        where key_name <> all(array['category', 'tags', 'question', 'options', 'media', 'promptVisual'])
      )
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'options') is distinct from 'array'
      or jsonb_array_length(public_payload->'options') < 2
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'media' and jsonb_typeof(public_payload->'media') not in ('null', 'object'))
      or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '1'
        and public_payload ? 'media' and public_payload->'media' ? 'assetId')
      or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '2' and (
        jsonb_typeof(public_payload->'media') is distinct from 'object'
        or not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
          'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'media'->>'type' <> 'image'
        or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
        or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
        or (public_payload->'media'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
        or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
        or (public_payload->'media'->>'height')::integer not between 1 and 8192
        or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'media' ? 'position' and (jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
          or char_length(public_payload->'media'->>'position') > 100))
      ))
      or (public_payload ? 'promptVisual' and jsonb_typeof(public_payload->'promptVisual') not in ('null', 'object')) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    for option in select value from jsonb_array_elements(public_payload->'options') loop
      if jsonb_typeof(option) is distinct from 'string' or char_length(btrim(option #>> '{}')) = 0 then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
    end loop;
    select count(distinct value) into option_count from jsonb_array_elements_text(public_payload->'options');
    if option_count <> jsonb_array_length(public_payload->'options') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;

    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (
        select 1 from jsonb_object_keys(solution_payload) key_name
        where key_name <> all(array['correctAnswer', 'explanation'])
      )
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) = 0
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements_text(public_payload->'options') value
      where value = solution_payload->>'correctAnswer'
    ) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
  end loop;
  if challenge->>'mode' = 'alphabet' then
    if exists (
      select 1 from jsonb_array_elements(document->'questions') question_row
      where question_row->>'source' <> 'library'
        or jsonb_typeof(question_row->'modeConfig') is distinct from 'object'
        or jsonb_typeof(question_row->'modeConfig'->'letter') is distinct from 'string'
        or char_length(question_row->'modeConfig'->>'letter') = 0
        or char_length(question_row->'modeConfig'->>'letter') > 4
        or question_row->'modeConfig'->>'letter' !~ '^[[:alpha:]]$'
        or not exists (
          select 1 from private.question_versions version
          where version.id = (question_row->>'questionVersionId')::uuid
            and version.status = 'published' and version.type = 'short-text'
        )
    ) then
      raise exception 'invalid_alphabet_item' using errcode = '22023';
    end if;
    if exists (
      select 1 from (
        select lower(question_row->'modeConfig'->>'letter') as letter
        from jsonb_array_elements(document->'questions') question_row
      ) letters group by letter having count(*) > 1
    ) then
      raise exception 'duplicate_alphabet_letter' using errcode = '22023';
    end if;
  elsif exists (
    select 1
    from jsonb_array_elements(document->'questions') question_row
    where question_row->>'type' = 'short-text'
      or (question_row->>'source' = 'library' and exists (
        select 1 from private.question_versions version
        where version.id = (question_row->>'questionVersionId')::uuid
          and version.type = 'short-text'
      ))
  ) then
    raise exception 'short_text_requires_alphabet' using errcode = '22023';
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.word_search_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

ALTER TABLE "private"."word_search_selection_events"
  ADD CONSTRAINT "word_search_selection_events_attempt_id_challenge_version__fkey" FOREIGN KEY (attempt_id, challenge_version_id)
    REFERENCES public.attempts(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."word_search_selection_events"
  ADD CONSTRAINT "word_search_selection_events_challenge_item_id_challenge_v_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX word_search_selection_events_correct_target_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, matched_target_id)
  WHERE (correct AND (matched_target_id IS NOT NULL));

CREATE INDEX word_search_selection_events_item_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, SEQUENCE);

CREATE INDEX word_search_selection_events_target_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, matched_target_id)
  WHERE correct;

REVOKE ALL ON FUNCTION "private"."submit_word_search_selection"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_word_search_selection"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."word_search_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."word_search_progress"(uuid, uuid) TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."word_search_selection_events" TO "postgres";
