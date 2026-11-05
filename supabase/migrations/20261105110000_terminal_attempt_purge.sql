-- Allow a superadmin to purge a terminal competitive attempt atomically.
alter table private.room_measurement_events add column attempt_id uuid references public.attempts(id);
alter table private.room_measurement_ratings add column attempt_id uuid references public.attempts(id);
create index room_measurement_events_attempt_idx on private.room_measurement_events(attempt_id) where attempt_id is not null;
create index room_measurement_ratings_attempt_idx on private.room_measurement_ratings(attempt_id) where attempt_id is not null;

create or replace function private.reject_rewrite() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_user = 'postgres' then
    declare
      target text := nullif(current_setting('flash.purge_attempt_id', true), '');
      row_data jsonb := to_jsonb(old);
    begin
      if target is not null and (case tg_table_name
        when 'attempts' then row_data->>'id' = target
        when 'audit_log' then row_data->>'entity_type' = 'attempt' and row_data->>'entity_id' = target
        when 'command_requests' then row_data#>>'{input,attemptId}' = target
          or row_data#>>'{result,attemptId}' = target
        else row_data->>'attempt_id' = target
      end) then
        return old;
      end if;
    end;
  end if;
  raise exception 'Historical records cannot be overwritten or deleted';
end;
$$;

create or replace function public.get_superadmin_attempt_publications(target_room_id uuid)
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
        and version.status in ('published', 'archived')
        and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial')
    ), '[]'::jsonb)
  );
end;
$$;

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
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'reversal')),
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
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'alphabet', 'survival', 'narrative', 'pyramid', 'time-trial');

  return inspection_payload;
end;
$$;

create or replace function public.save_my_season_rating(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); eligibility jsonb; measurement private.room_measurements%rowtype; previous private.room_measurement_ratings%rowtype;
 target_attempt uuid := (input->>'attemptId')::uuid;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(array['id','value','publicationId','seasonId','attemptId']))
   or input->>'id' is null or input->>'publicationId' is null or input->>'seasonId' is null or target_attempt is null
   or coalesce(input->>'value','') !~ '^[1-5]$' then raise exception 'invalid_rating' using errcode='22023'; end if;
 perform 1 from public.attempts a where a.id=target_attempt and a.player_id=actor
   and a.scheduled_challenge_id=(input->>'publicationId')::uuid
   and a.kind='competitive' and a.status='completed' for share;
 if not found then raise exception 'not_authorized' using errcode='42501'; end if;
 eligibility:=public.get_my_season_rating((input->>'publicationId')::uuid);
 if eligibility->>'seasonId' is distinct from input->>'seasonId' then raise exception 'not_authorized' using errcode='42501'; end if;
 select * into measurement from private.room_measurements where season_id=(input->>'seasonId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('season-rating:'||measurement.id||':'||actor,0));
 select * into previous from private.room_measurement_ratings where measurement_id=measurement.id and id=(input->>'id')::uuid;
 if found then
   if previous.player_id<>actor or previous.publication_id<>(input->>'publicationId')::uuid or previous.value<>(input->>'value')::integer or previous.attempt_id is distinct from target_attempt then raise exception 'idempotency_conflict' using errcode='40001'; end if;
 else
   if not coalesce((eligibility->>'eligible')::boolean,false) then raise exception 'rating_closed' using errcode='22023'; end if;
   if (select count(*) from private.room_measurement_ratings where measurement_id=measurement.id and player_id=actor and received_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'measurement_rate_limited'; end if;
   insert into private.room_measurement_ratings(measurement_id,id,player_id,publication_id,attempt_id,value)
   values(measurement.id,(input->>'id')::uuid,actor,(input->>'publicationId')::uuid,target_attempt,(input->>'value')::integer);
 end if;
 return public.get_my_season_rating((input->>'publicationId')::uuid);
end $$;

create or replace function public.record_room_measurement_event(input jsonb) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=private.current_player_id(); room public.rooms%rowtype; measurement private.room_measurements%rowtype;
 participant private.room_measurement_participants%rowtype; previous private.room_measurement_events%rowtype;
 target_attempt uuid := (input->>'attemptId')::uuid;
 pid uuid:=nullif(input->>'publicationId','')::uuid; event_at timestamptz:=(input->>'occurredAt')::timestamptz;
 visit uuid:=(input->>'visitId')::uuid; event_id_value uuid:=(input->>'eventId')::uuid;
 instant timestamptz:=clock_timestamp(); recorded boolean:=false;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if jsonb_typeof(input)<>'object' or exists(select 1 from jsonb_object_keys(input) k where not k=any(array['eventId','type','roomId','publicationId','visitId','occurredAt','appVersion','attemptId']))
   or input->>'eventId' is null or input->>'visitId' is null or input->>'roomId' is null or input->>'occurredAt' is null
   or input->>'appVersion' is null
   or input->>'type' not in ('room_viewed','challenge_intro_viewed','ranking_viewed','review_viewed','rehearsal_started','rehearsal_completed') then
   raise exception 'invalid_event' using errcode='22023';
 end if;
 if input->>'type'='review_viewed' then
   perform 1 from public.attempts a where a.id=target_attempt and a.scheduled_challenge_id=pid for share;
   if not found or not private.can_review_competitive_attempt(target_attempt) then return false; end if;
 elsif target_attempt is not null then
   raise exception 'invalid_context' using errcode='22023';
 end if;
 if pid is null and input->>'type' not in ('room_viewed','ranking_viewed') then raise exception 'invalid_context' using errcode='22023'; end if;
 -- Client time is diagnostic; admission and attribution use the server reception clock.
 if not isfinite(event_at) or length(coalesce(input->>'appVersion','')) not between 1 and 80 then raise exception 'invalid_event' using errcode='22023'; end if;
 select * into room from public.rooms where slug=input->>'roomId' and status='active';
 if not found then return false; end if;
 for measurement in select m.* from private.room_measurements m join public.seasons s on s.id=m.season_id
   where m.room_id=room.id and m.status='running' and s.status in ('active','scheduled') and instant<=s.ends_at
     and (pid is not null or s.id=(select preferred.id from public.seasons preferred
       where preferred.room_id=room.id and preferred.status in ('active','scheduled')
       order by case preferred.status when 'active' then 0 else 1 end,
         case when preferred.status='scheduled' then preferred.starts_at end,preferred.starts_at desc,preferred.id limit 1))
   order by m.id loop
   perform private.sync_room_measurement(measurement.id);
   if not exists(select 1 from public.room_memberships membership join public.players player on player.id=membership.player_id
     where membership.room_id=room.id and membership.player_id=actor and membership.status='active'
       and membership.role in ('owner','admin','member') and player.status='active'
       and not exists(select 1 from private.platform_role_assignments op where op.player_id=actor)) then continue; end if;
   select * into participant from private.room_measurement_participants p
     where p.measurement_id=measurement.id and p.player_id=actor;
   if not found or instant<greatest(measurement.started_at,participant.included_at) then continue; end if;
   if pid is not null and not exists(select 1 from private.room_measurement_publications scope
     join public.scheduled_challenges challenge on challenge.id=scope.publication_id
     where scope.measurement_id=measurement.id and scope.publication_id=pid
       and scope.included_at<=instant and challenge.status<>'cancelled') then continue; end if;
   perform pg_advisory_xact_lock(hashtextextended('room-measurement-event:'||measurement.id||':'||actor,0));
   select * into previous from private.room_measurement_events where measurement_id=measurement.id and event_id=event_id_value;
   if found then
     if previous.player_id<>actor or previous.type<>input->>'type' or previous.visit_id<>visit or previous.publication_id is distinct from pid or previous.attempt_id is distinct from target_attempt then
       raise exception 'idempotency_conflict' using errcode='40001';
     end if;
     recorded:=true; continue;
   end if;
   -- Deduplicate execution signals inside the actor lock and before checking quota.
   if input->>'type' in ('rehearsal_started','rehearsal_completed') and exists(
     select 1 from private.room_measurement_events event_row where event_row.measurement_id=measurement.id
       and event_row.player_id=actor and event_row.publication_id=pid
       and event_row.type=input->>'type' and event_row.visit_id=visit
   ) then recorded:=true; continue; end if;
   if (select count(*) from private.room_measurement_events event_row where event_row.measurement_id=measurement.id
     and event_row.player_id=actor and event_row.received_at>instant-interval '1 minute')>=60 then continue; end if;
   insert into private.room_measurement_events(measurement_id,event_id,player_id,publication_id,attempt_id,type,visit_id,occurred_at,app_version)
   values(measurement.id,event_id_value,actor,pid,target_attempt,input->>'type',visit,event_at,input->>'appVersion') on conflict do nothing;
   recorded:=true;
 end loop;
 return recorded;
end $$;

create index command_requests_input_attempt_idx on private.command_requests ((input->>'attemptId'));
create index command_requests_result_attempt_idx on private.command_requests ((result->>'attemptId'));

create table private.attempt_start_preparations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  scheduled_challenge_id uuid not null references public.scheduled_challenges(id),
  expected_attempt_id uuid,
  token_hash text not null,
  expires_at timestamptz not null
);
create index attempt_start_preparations_pair_idx
  on private.attempt_start_preparations(player_id, scheduled_challenge_id);
alter table private.attempt_start_preparations enable row level security;
revoke all on private.attempt_start_preparations from public, anon, authenticated, service_role;

create function private.issue_attempt_start(
  publication_id uuid, expected_attempt_id uuid, fresh_token text, previous_token text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  existing_id uuid;
  use_previous boolean := false;
  preparation_id uuid;
begin
  perform private.prepare_attempt_session(publication_id);
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || publication_id, 0));

  select a.id into existing_id from public.attempts a
  where a.player_id = actor and a.scheduled_challenge_id = publication_id and a.kind = 'competitive';
  if expected_attempt_id is not null and existing_id is distinct from expected_attempt_id then
    raise exception 'attempt_session_missing' using errcode = '55000';
  end if;

  select exists (
    select 1 from private.attempt_sessions s where s.attempt_id = existing_id and s.revoked_at is null
      and s.session_token_hash = case when length(previous_token) >= 32 then private.secret_hash(previous_token) end
  ) into use_previous;
  delete from private.attempt_start_preparations p
  where p.player_id = actor and p.expires_at <= clock_timestamp();
  insert into private.attempt_start_preparations (
    player_id, scheduled_challenge_id, expected_attempt_id, token_hash, expires_at
  ) values (
    actor, publication_id, existing_id,
    private.secret_hash(case when use_previous then previous_token else fresh_token end),
    clock_timestamp() + interval '5 minutes'
  ) returning id into preparation_id;
  return jsonb_build_object('preparationId', preparation_id, 'usePreviousToken', use_previous);
end;
$$;
alter function private.issue_attempt_start(uuid, uuid, text, text) owner to postgres;
revoke all on function private.issue_attempt_start(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function private.issue_attempt_start(uuid, uuid, text, text) to service_role;

create function private.start_prepared_attempt(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  publication_id uuid := (input->>'scheduledChallengeId')::uuid;
  preparation private.attempt_start_preparations%rowtype;
begin
  perform private.prepare_attempt_session(publication_id);
  -- Keep the same lock order as execute_command -> handle_attempt_start.
  perform private.lock_command_key(actor, input->>'idempotencyKey');
  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || publication_id, 0));
  select * into preparation from private.attempt_start_preparations p
  where p.id = (input->>'preparationId')::uuid and p.player_id = actor
    and p.scheduled_challenge_id = publication_id and p.expires_at > clock_timestamp()
    and p.token_hash = private.secret_hash(input->>'sessionToken');
  if not found or (preparation.expected_attempt_id is not null and not exists (
    select 1 from public.attempts a where a.id = preparation.expected_attempt_id
      and a.player_id = actor and a.scheduled_challenge_id = publication_id
  )) then
    raise exception 'attempt_session_missing' using errcode = '55000';
  end if;
  return private.start_attempt(input - 'preparationId');
end;
$$;
alter function private.start_prepared_attempt(jsonb) owner to postgres;
revoke all on function private.start_prepared_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.start_prepared_attempt(jsonb) to service_role;

create function private.purge_terminal_attempt(input jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  target_id uuid := (input->>'attemptId')::uuid;
  target_publication uuid := (input->>'scheduledChallengeId')::uuid;
  room_key text;
  target public.attempts%rowtype;
  previous_purge text;
begin
  if not exists (select 1 from private.platform_role_assignments p
    where p.player_id = actor and p.role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if target_id is null then raise exception 'invalid_command' using errcode = '22023'; end if;

  select r.slug into room_key
  from public.scheduled_challenges p
  join public.seasons s on s.id = p.season_id
  join public.rooms r on r.id = s.room_id
  where p.id = target_publication and r.id = (input->>'roomId')::uuid and r.status = 'active';
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into target from public.attempts a where a.id = target_id;
  if not found then return room_key; end if;
  if target.scheduled_challenge_id <> target_publication or target.kind <> 'competitive' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('flash-start:' || target.player_id || ':' || target_publication, 0));
  select * into target from public.attempts a where a.id = target_id for update;
  if not found then return room_key; end if;
  if target.status not in ('completed', 'abandoned', 'invalidated') then
    raise exception 'attempt_not_terminal' using errcode = '55000';
  end if;

  previous_purge := current_setting('flash.purge_attempt_id', true);
  perform set_config('flash.purge_attempt_id', target_id::text, true);

  delete from private.attempt_start_preparations p
  where p.player_id = target.player_id and p.scheduled_challenge_id = target_publication;
  delete from private.room_measurement_ratings r
  where r.attempt_id = target_id or (r.attempt_id is null
    and r.player_id = target.player_id and r.publication_id = target_publication);
  delete from private.room_measurement_events e where e.type = 'review_viewed'
    and (e.attempt_id = target_id or (e.attempt_id is null
      and e.player_id = target.player_id and e.publication_id = target_publication));
  delete from private.command_requests c
  where c.input->>'attemptId' = target_id::text or c.result->>'attemptId' = target_id::text;
  delete from private.audit_log l where l.entity_type = 'attempt' and l.entity_id = target_id;

  delete from private.flash_point_entries e where e.attempt_id = target_id;
  delete from private.attempt_sessions s where s.attempt_id = target_id;
  delete from private.attempt_answers a where a.attempt_id = target_id;
  delete from private.answer_receipts r where r.attempt_id = target_id;
  delete from private.interaction_intervals i where i.attempt_id = target_id;
  delete from private.attempt_timing_units t where t.attempt_id = target_id;
  delete from private.prepared_interactions i where i.attempt_id = target_id;
  delete from private.progressive_clue_reveal_events e where e.attempt_id = target_id;
  delete from private.logic_code_attempt_events e where e.attempt_id = target_id;
  delete from private.mini_wordle_guess_events e where e.attempt_id = target_id;
  delete from private.queens_placement_events e where e.attempt_id = target_id;
  delete from private.queens_validation_events e where e.attempt_id = target_id;
  delete from private.word_search_selection_events e where e.attempt_id = target_id;
  delete from public.attempts a where a.id = target_id;

  perform set_config('flash.purge_attempt_id', coalesce(previous_purge, ''), true);
  return room_key;
end;
$$;
alter function private.purge_terminal_attempt(jsonb) owner to postgres;
revoke all on function private.purge_terminal_attempt(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.purge_terminal_attempt(jsonb) to service_role;
