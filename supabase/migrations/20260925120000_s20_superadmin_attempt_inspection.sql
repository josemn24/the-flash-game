begin;
-- S20 — Privileged attempt inspection for the operations portal.
-- Reads are narrowly projected through authenticated RPCs; private tables remain
-- inaccessible to browser roles. Corrections continue through 90_commands.sql.

create index attempts_publication_started_idx
  on public.attempts (scheduled_challenge_id, started_at desc, id desc);

create or replace function private.adjust_result(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  attempt_status text;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) = 'object'
    and input->>'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select attempt.status into attempt_status
    from public.attempts attempt
    where attempt.id = (input->>'attemptId')::uuid;
    if attempt_status is not null and attempt_status not in ('completed', 'abandoned') then
      raise exception 'attempt_not_terminal' using errcode = '55000';
    end if;
  end if;
  return private.execute_command('adjust', input);
end;
$$;

create function public.get_superadmin_attempt_publications(target_room_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.rooms room
    where room.id = target_room_id and room.status = 'active'
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'roomId', target_room_id,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by season.starts_at desc, schedule.number, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status = 'published'
        and version.mode in ('flash', 'alphabet', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_superadmin_room_attempts(
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
    and version.status = 'published'
    and version.mode in ('flash', 'alphabet', 'survival', 'pyramid');

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
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'reversal')) as is_corrected
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

create function public.get_superadmin_attempt_inspection(
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
        'resultDetails', answer.result_details,
        'awardedPoints', answer.points,
        'presentedAt', answer.presented_at,
        'submittedAt', answer.submitted_at,
        'timeUsedMs', answer.time_used_ms
      ) order by item.position)
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      left join private.attempt_answers answer
        on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
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
    and version.status = 'published'
    and version.mode in ('flash', 'alphabet', 'survival', 'pyramid');

  return inspection_payload;
end;
$$;

alter function public.get_superadmin_attempt_publications(uuid) owner to postgres;
alter function public.get_superadmin_room_attempts(uuid, uuid, timestamptz, uuid, integer) owner to postgres;
alter function public.get_superadmin_attempt_inspection(uuid, uuid, uuid) owner to postgres;

revoke all on function public.get_superadmin_attempt_publications(uuid),
  public.get_superadmin_room_attempts(uuid, uuid, timestamptz, uuid, integer),
  public.get_superadmin_attempt_inspection(uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function public.get_superadmin_attempt_publications(uuid),
  public.get_superadmin_room_attempts(uuid, uuid, timestamptz, uuid, integer),
  public.get_superadmin_attempt_inspection(uuid, uuid, uuid)
  to authenticated;
commit;

