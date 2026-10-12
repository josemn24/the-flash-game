-- Contrarreloj facts remain private. Public callers only see authorized projections.
set local check_function_bodies = off;

create function private.assert_time_trial_content(target_version uuid) returns void
language plpgsql volatile set search_path = '' as $$
declare version private.challenge_versions%rowtype;
begin
  select * into version from private.challenge_versions where id = target_version;
  if version.mode <> 'time-trial' then return; end if;
  if version.config_schema_version <> 1 or version.mode_config <> '{}'::jsonb
    or version.global_time_limit_ms is null or version.global_time_limit_ms <= 0
    or version.global_time_limit_ms % 1000 <> 0
    or (select count(*) from private.challenge_items where challenge_version_id = target_version) not between 2 and 20
    or (select coalesce(sum(points),0) from private.challenge_items where challenge_version_id = target_version) <> 100
    or exists (
      select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
      where i.challenge_version_id = target_version and (
        i.points <= 0 or i.config_schema_version <> 1 or i.mode_config <> '{}'::jsonb
        or q.type <> 'queens' or q.payload_schema_version <> 1
        or not private.is_supported_flash_question(q.id)
      )
    ) or (select max(position) from private.challenge_items where challenge_version_id = target_version)
      <> (select count(*) from private.challenge_items where challenge_version_id = target_version) then
    raise exception 'invalid_time_trial_content' using errcode = '22023';
  end if;
end;
$$;

create function private.time_trial_progress(target_attempt uuid) returns jsonb
language sql volatile set search_path = '' as $$
  with facts as (
    select a.*, cv.global_time_limit_ms,
      (select count(*)::integer from private.challenge_items i where i.challenge_version_id = a.challenge_version_id) as total,
      (select count(*)::integer from private.attempt_answers aa where aa.attempt_id = a.id and aa.status = 'correct') as solved,
      (select max(r.effective_submitted_at) from private.attempt_answers aa
        join private.answer_receipts r on r.id = aa.receipt_id
        where aa.attempt_id = a.id and aa.status = 'correct' and not r.timed_out and r.received_at < a.deadline_at) as last_correct,
      (select coalesce(sum(points),0)::integer from private.attempt_answers aa where aa.attempt_id = a.id) as earned
    from public.attempts a join private.challenge_versions cv on cv.id = a.challenge_version_id
    where a.id = target_attempt and cv.mode = 'time-trial'
  )
  select jsonb_build_object(
    'kind','time-trial','currentIndex', least(solved,total - 1),
    'solvedCount',solved,'totalCount',total,'points',earned,
    'clockStartedAt',deadline_at - global_time_limit_ms * interval '1 millisecond',
    'deadlineAt',deadline_at,'serverNow',clock_timestamp(),
    'elapsedTimeMs',case when deadline_at is null then 0 else greatest(0,floor(extract(epoch from (
      (case when solved = total then last_correct
        when status = 'completed' and exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status = 'incorrect') then (select max(aa.submitted_at) from private.attempt_answers aa where aa.attempt_id = facts.id)
        else least(coalesce(completed_at,clock_timestamp()),deadline_at) end)
      - (deadline_at - global_time_limit_ms * interval '1 millisecond')))*1000))::bigint end,
    'lastCorrectElapsedMs',floor(extract(epoch from (last_correct - (deadline_at - global_time_limit_ms * interval '1 millisecond'))) * 1000)::bigint,
    'endReason',case
      when terminal_reason in ('all_solved','validation_limit','time_limit','recovery_interrupted') then terminal_reason
      when solved = total then 'all_solved'
      when exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status = 'incorrect') then 'validation_limit'
      when deadline_at is not null and clock_timestamp() >= deadline_at then 'time_limit'
      when exists (select 1 from private.attempt_answers aa where aa.attempt_id = facts.id and aa.status <> 'correct') then 'recovery_interrupted'
      else null end
  ) from facts
$$;

-- Called only after the completion command locks and authorizes the attempt.
-- Untouched items receive neither a fabricated answer nor a timing interval.
create function private.close_time_trial_interaction(target_attempt uuid, closed_at timestamptz, reason text) returns void
language plpgsql volatile set search_path = '' as $$
declare segment private.interaction_intervals%rowtype; receipt private.answer_receipts%rowtype; version_id uuid;
begin
  select * into segment from private.interaction_intervals where attempt_id = target_attempt and ended_at is null for update;
  if not found then return; end if;
  select challenge_version_id into version_id from public.attempts where id = target_attempt;
  update private.interaction_intervals set ended_at = greatest(started_at,closed_at), end_reason = reason where id = segment.id;
  insert into private.answer_receipts(attempt_id,challenge_item_id,challenge_version_id,answer,received_at,presented_at,effective_submitted_at,time_used_ms,timed_out)
  values(target_attempt,segment.challenge_item_id,version_id,null,clock_timestamp(),segment.started_at,
    greatest(segment.started_at,closed_at),greatest(0,floor(extract(epoch from (closed_at - segment.started_at))*1000))::bigint,true)
  returning * into receipt;
  insert into private.attempt_answers(attempt_id,challenge_item_id,challenge_version_id,receipt_id,status,answer,points,presented_at,submitted_at,time_used_ms,idempotency_key)
  values(target_attempt,segment.challenge_item_id,version_id,receipt.id,'unanswered',null,0,receipt.presented_at,receipt.effective_submitted_at,receipt.time_used_ms,'time-trial:timeout:' || receipt.id);
end;
$$;

alter function private.assert_time_trial_content(uuid) owner to postgres;
alter function private.time_trial_progress(uuid) owner to postgres;
alter function private.close_time_trial_interaction(uuid,timestamptz,text) owner to postgres;
revoke all on function private.assert_time_trial_content(uuid), private.time_trial_progress(uuid), private.close_time_trial_interaction(uuid,timestamptz,text)
  from public,anon,authenticated,service_role;
