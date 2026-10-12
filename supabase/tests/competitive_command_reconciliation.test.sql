-- Closure retains accepted facts and labels only genuine permission revocation.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

create temporary table closure_snapshots (
  attempt_id uuid, reason text, previous_version bigint,
  receipts jsonb, answers jsonb
);
do $$
declare actor text; reason text; target uuid;
begin
  foreach actor in array array['owner', 'member', 'member2'] loop
    reason := case actor when 'owner' then 'abandon'
      when 'member' then 'inactivity_timeout' else 'permission_revoked' end;
    perform test_support.as_actor(actor);
    set local role service_role;
    perform test_support.run('start_attempt', jsonb_build_object(
      'scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat(actor, 40)));
    perform test_support.run('prepare_interaction');
    perform test_support.run('receive_answer', '{"answer":true}');
    perform test_support.run('record_evaluation', '{"status":"correct","points":50}');
    perform test_support.run('prepare_interaction');
    reset role;
    select (state->>'attemptId')::uuid into target from test_support.runtime;
    insert into closure_snapshots
    select target, reason, attempt.lock_version,
      (select jsonb_agg(to_jsonb(receipt) order by receipt.id)
        from private.answer_receipts receipt where receipt.attempt_id = target),
      (select jsonb_agg(to_jsonb(answer) order by answer.id)
        from private.attempt_answers answer where answer.attempt_id = target)
    from public.attempts attempt where attempt.id = target;
  end loop;
end;
$$;

select is(private.close_attempt_as_abandoned(attempt_id, clock_timestamp(), reason,
  null, 'reconciliation-close-' || reason, 'reconciliation fixture'), true,
  reason || ': closure succeeds') from closure_snapshots;
select is(attempt.status::text, 'abandoned', snapshot.reason || ': terminal status')
  from closure_snapshots snapshot join public.attempts attempt on attempt.id = snapshot.attempt_id;
select is(attempt.terminal_reason, snapshot.reason, snapshot.reason || ': precise terminal reason')
  from closure_snapshots snapshot join public.attempts attempt on attempt.id = snapshot.attempt_id;
select is(attempt.lock_version, snapshot.previous_version + 1, snapshot.reason || ': one version increment')
  from closure_snapshots snapshot join public.attempts attempt on attempt.id = snapshot.attempt_id;
select is(session.revocation_reason, case when snapshot.reason = 'permission_revoked'
  then 'permission_revoked' else 'terminal' end, snapshot.reason || ': precise session revocation')
  from closure_snapshots snapshot join private.attempt_sessions session on session.attempt_id = snapshot.attempt_id;
select ok(session.revoked_at is not null, snapshot.reason || ': session revoked')
  from closure_snapshots snapshot join private.attempt_sessions session on session.attempt_id = snapshot.attempt_id;
select is((select jsonb_agg(to_jsonb(receipt) order by receipt.id)
  from private.answer_receipts receipt where receipt.attempt_id = snapshot.attempt_id), snapshot.receipts,
  snapshot.reason || ': accepted receipts preserved') from closure_snapshots snapshot;
select is((select jsonb_agg(to_jsonb(answer) order by answer.id)
  from private.attempt_answers answer where answer.attempt_id = snapshot.attempt_id), snapshot.answers,
  snapshot.reason || ': accepted evaluations preserved') from closure_snapshots snapshot;
select is((select count(*) from private.interaction_intervals interval_row
  where interval_row.attempt_id = snapshot.attempt_id and interval_row.ended_at is null), 0::bigint,
  snapshot.reason || ': no open intervals') from closure_snapshots snapshot;
select is((select count(*) from private.prepared_interactions
  where attempt_id = snapshot.attempt_id), 0::bigint,
  snapshot.reason || ': no prepared interaction') from closure_snapshots snapshot;
select is((select count(*) from private.flash_point_entries where attempt_id = snapshot.attempt_id), 0::bigint,
  snapshot.reason || ': no points credited') from closure_snapshots snapshot;
select is(private.close_attempt_as_abandoned(attempt_id, clock_timestamp(), reason,
  null, 'reconciliation-close-repeat-' || reason, 'reconciliation fixture'), false,
  reason || ': repeated closure has no effect') from closure_snapshots;
select is((select count(*) from private.audit_log where entity_id = snapshot.attempt_id
  and action in ('close_attempt_abandon', 'expire_stale_attempt', 'close_attempt_permission_revoked')), 1::bigint,
  snapshot.reason || ': one closure audit event') from closure_snapshots snapshot;

select * from finish();
rollback;
