-- The pair-event protocol is removed by the preceding declarative migration.
-- Close any attempt that was still using that protocol before the deployment.
-- Historical terminal attempts remain untouched.
do $$
declare
  migration_instant timestamptz := clock_timestamp();
begin
  update private.interaction_intervals interval_row
  set ended_at = greatest(interval_row.started_at, migration_instant),
      end_reason = 'abandon'
  where interval_row.ended_at is null
    and exists (
      select 1
      from public.attempts attempt_row
      join private.challenge_items challenge_item
        on challenge_item.challenge_version_id = attempt_row.challenge_version_id
      join private.question_versions question_version
        on question_version.id = challenge_item.question_version_id
      where attempt_row.id = interval_row.attempt_id
        and attempt_row.status = 'in_progress'
        and question_version.type = 'matching'
    );

  update private.attempt_sessions session_row
  set revoked_at = migration_instant
  where session_row.revoked_at is null
    and exists (
      select 1
      from public.attempts attempt_row
      join private.challenge_items challenge_item
        on challenge_item.challenge_version_id = attempt_row.challenge_version_id
      join private.question_versions question_version
        on question_version.id = challenge_item.question_version_id
      where attempt_row.id = session_row.attempt_id
        and attempt_row.status = 'in_progress'
        and question_version.type = 'matching'
    );

  update public.attempts attempt_row
  set status = 'abandoned',
      completed_at = migration_instant,
      terminal_reason = 'matching_protocol_migrated',
      progress_payload = null,
      lock_version = lock_version + 1
  where attempt_row.status = 'in_progress'
    and exists (
      select 1
      from private.challenge_items challenge_item
      join private.question_versions question_version
        on question_version.id = challenge_item.question_version_id
      where challenge_item.challenge_version_id = attempt_row.challenge_version_id
        and question_version.type = 'matching'
    );
end;
$$;
