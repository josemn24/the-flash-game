-- Internal command engine: only the named wrappers at the end receive EXECUTE.
-- The connection adapter MUST verify Auth and set request.jwt.claims transaction-locally.
-- A service JWT by itself is not a human identity. Never copy browser claims without verification.
set local check_function_bodies = off;
create function private.command_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.current_player_id();
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return actor;
end;
$$;

create function private.secret_hash(secret text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if secret is null or length(secret) < 32 then raise exception 'invalid_token' using errcode = '22023'; end if;
  return encode(sha256(convert_to(secret, 'UTF8')), 'hex');
end;
$$;

create function private.next_attempt_item(target_attempt uuid) returns uuid
language sql stable set search_path = '' as $$
  select i.id from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  where a.id = target_attempt and not exists (
    select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id
  )
  order by
    case when cv.mode = 'alphabet' and exists (select 1 from private.interaction_intervals x
      where x.attempt_id = a.id and x.challenge_item_id = i.id) then 1 else 0 end,
    case when cv.mode = 'alphabet' and i.position <= coalesce((
      select ci.position from private.interaction_intervals x
      join private.challenge_items ci on ci.id = x.challenge_item_id
      where x.attempt_id = a.id order by x.started_at desc, x.id desc limit 1
    ), 0) then 1 else 0 end,
    i.position limit 1
$$;

create function private.execute_command(op text, input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
$$;

create function private.start_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('start', input)
$$;
alter function private.start_attempt(jsonb) owner to postgres;
revoke all on function private.start_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.start_attempt(jsonb) to service_role;

create function private.take_over_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- Cross-device control transfer is deliberately deferred for the MVP.
  raise exception 'takeover_disabled' using errcode = '55000';
end;
$$;
alter function private.take_over_attempt(jsonb) owner to postgres;
revoke all on function private.take_over_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.take_over_attempt(jsonb) to service_role;

create function private.prepare_interaction(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  -- A lost prepare response or a countdown race may leave the interval open.
  -- Re-reading is safe: execute_command exposes only public payload/progress,
  -- and an already received answer is still blocked as evaluation_pending.
  if exists (
    select 1 from private.command_requests
    where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey'
      and operation = 'prepare'
  ) then
    return private.execute_command('prepare', input);
  end if;
  return private.execute_command('prepare', input);
end;
$$;
alter function private.prepare_interaction(jsonb) owner to postgres;
revoke all on function private.prepare_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_interaction(jsonb) to service_role;

create function private.receive_answer(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('receive', input)
$$;
alter function private.receive_answer(jsonb) owner to postgres;
revoke all on function private.receive_answer(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.receive_answer(jsonb) to service_role;

create function private.pass_interaction(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('pass', input)
$$;
alter function private.pass_interaction(jsonb) owner to postgres;
revoke all on function private.pass_interaction(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.pass_interaction(jsonb) to service_role;

create function private.record_evaluation(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('evaluate', input)
$$;
alter function private.record_evaluation(jsonb) owner to postgres;
revoke all on function private.record_evaluation(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.record_evaluation(jsonb) to service_role;

create function private.complete_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('complete', input)
$$;
alter function private.complete_attempt(jsonb) owner to postgres;
revoke all on function private.complete_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.complete_attempt(jsonb) to service_role;

create function private.abandon_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('abandon', input)
$$;
alter function private.abandon_attempt(jsonb) owner to postgres;
revoke all on function private.abandon_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.abandon_attempt(jsonb) to service_role;

create function private.accept_invitation(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('accept_invitation', input)
$$;
alter function private.accept_invitation(jsonb) owner to postgres;
revoke all on function private.accept_invitation(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.accept_invitation(jsonb) to service_role;

create function private.invalidate_attempt(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('invalidate', input)
$$;
alter function private.invalidate_attempt(jsonb) owner to postgres;
revoke all on function private.invalidate_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.invalidate_attempt(jsonb) to service_role;

create function private.adjust_result(input jsonb) returns jsonb
language sql security definer set search_path = '' as $$
  select private.execute_command('adjust', input)
$$;
alter function private.adjust_result(jsonb) owner to postgres;
revoke all on function private.adjust_result(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.adjust_result(jsonb) to service_role;

alter function private.execute_command(text, jsonb) owner to postgres;
alter function private.command_actor() owner to postgres;
revoke all on function private.execute_command(text, jsonb), private.command_actor(),
  private.secret_hash(text), private.next_attempt_item(uuid) from public, anon, authenticated, service_role;

-- Internal evaluator input: immutable reception plus the exact frozen content version.
-- This result includes solutions and MUST NEVER be serialized to the browser.
create function private.read_evaluation_context(target_receipt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'receiptId', r.id, 'answer', case when q.type = 'matching' then coalesce((
      select jsonb_object_agg(e.left_item_id, e.right_item_id)
      from private.matching_pair_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '{}'::jsonb) when q.type = 'queens' then private.queens_answer(r.attempt_id, r.challenge_item_id) else r.answer end, 'receivedAt', r.received_at,
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
$$;
alter function private.read_evaluation_context(uuid, text) owner to postgres;
revoke all on function private.read_evaluation_context(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.read_evaluation_context(uuid, text) to service_role;

-- S04 recovery has a separate private command because it intentionally turns an
-- already prepared interval into a null-answer receipt before evaluating it.
create function private.recover_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  cv private.challenge_versions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      select * into cv from private.challenge_versions where id = a.challenge_version_id;
      if cv.mode = 'alphabet' and instant < unit.deadline_at then
        update private.interaction_intervals
        set ended_at = greatest(segment.started_at, least(instant, unit.deadline_at)),
            end_reason = 'recovery_interrupted'
        where id = segment.id;
        result := jsonb_build_object('receiptId', null, 'recovered', true,
          'recoveryInterrupted', true, 'challengeItemId', segment.challenge_item_id);
      elsif question.type in ('mini-wordle', 'logic-code', 'progressive-clues', 'matching', 'progressive-image', 'queens') and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id, null, instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$$;
alter function private.recover_attempt(jsonb) owner to postgres;
revoke all on function private.recover_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.recover_attempt(jsonb) to service_role;

create function private.read_attempt_recovery(target_attempt uuid, session_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status,
    'lockVersion', a.lock_version,
    'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id
      and not exists (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
      'status', aa.status, 'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms) order by i.position)
      from private.attempt_answers aa join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)
  ) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive'
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$$;
alter function private.read_attempt_recovery(uuid, text) owner to postgres;
revoke all on function private.read_attempt_recovery(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.read_attempt_recovery(uuid, text) to service_role;
