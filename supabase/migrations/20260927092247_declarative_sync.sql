SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.archive_challenge_version_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  challenge_version_id_value uuid;
  expected_updated_at timestamptz;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  version_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-archive:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_challenge_version' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into version_row
  from private.challenge_versions version
  where version.id = challenge_version_id_value
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if version_row.mode not in ('flash', 'survival', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;
  if version_row.status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_row.updated_at <> expected_updated_at then
    raise exception 'content_conflict' using errcode = '40001';
  end if;
  select * into definition_row
  from private.challenge_definitions definition
  where definition.id = version_row.challenge_definition_id;

  update private.challenge_versions version
  set status = 'archived'
  where version.id = version_row.id;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = version_row.id;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'archive_challenge_version', 'challenge_version', version_row.id, reason_value, key,
    jsonb_build_object('status', 'published', 'versionNumber', version_row.version_number),
    jsonb_build_object('status', 'archived', 'versionNumber', version_row.version_number)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_challenge_version', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_challenge_revision_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  source_challenge_version_id uuid;
  target_challenge_version_id uuid := gen_random_uuid();
  safe_input jsonb;
  cached private.command_requests%rowtype;
  source_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  next_version integer;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'sourceChallengeVersionId', 'reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'sourceChallengeVersionId', 'reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey', 'sourceChallengeVersionId', 'reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    source_challenge_version_id := (input->>'sourceChallengeVersionId')::uuid;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'sourceChallengeVersionId', source_challenge_version_id,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-revision:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_challenge_revision' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into source_row
  from private.challenge_versions version
  where version.id = source_challenge_version_id
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if source_row.status not in ('published', 'archived') then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if source_row.mode not in ('flash', 'survival', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;

  -- The definition row serializes version-number allocation for all branches
  -- of the same challenge. The source row is already locked above, so an
  -- archive/publish race cannot change the graph being copied.
  select * into definition_row
  from private.challenge_definitions definition
  where definition.id = source_row.challenge_definition_id
  for update;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  select coalesce(max(version.version_number), 0) + 1 into next_version
  from private.challenge_versions version
  where version.challenge_definition_id = definition_row.id;

  insert into private.challenge_versions(
    id, challenge_definition_id, version_number, config_schema_version, status, mode,
    title, subtitle, description, global_time_limit_ms, max_score, mode_config,
    created_by_player_id
  ) values (
    target_challenge_version_id, definition_row.id, next_version, source_row.config_schema_version,
    'draft', source_row.mode, source_row.title, source_row.subtitle, source_row.description,
    source_row.global_time_limit_ms, source_row.max_score, source_row.mode_config, actor
  );

  insert into private.challenge_items(
    id, challenge_version_id, question_version_id, position, points,
    config_schema_version, mode_config
  )
  select
    gen_random_uuid(), target_challenge_version_id, item.question_version_id, item.position,
    item.points, item.config_schema_version, item.mode_config
  from private.challenge_items item
  where item.challenge_version_id = source_row.id
  order by item.position;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = target_challenge_version_id;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_challenge_revision', 'challenge_version', target_challenge_version_id,
    reason_value, key,
    jsonb_build_object(
      'sourceChallengeVersionId', source_row.id,
      'sourceVersionNumber', source_row.version_number,
      'sourceStatus', source_row.status
    ),
    jsonb_build_object(
      'challengeDefinitionId', definition_row.id,
      'challengeVersionId', target_challenge_version_id,
      'versionNumber', next_version,
      'status', 'draft',
      'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = target_challenge_version_id)
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_challenge_revision', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.superadmin_challenge_version_snapshot (
  target_challenge_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'configSchemaVersion', version.config_schema_version,
    'modeConfig', version.mode_config,
    'globalTimeLimitMs', version.global_time_limit_ms,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeItemId', item.id,
          'position', item.position,
          'questionVersionId', question.id,
          'questionDefinitionId', question.question_definition_id,
          'questionVersionNumber', question.version_number,
          'questionStatus', question.status,
          'slug', question_definition.slug,
          'type', question.type,
          'payloadSchemaVersion', question.payload_schema_version,
          'timeLimitMs', question.time_limit_ms,
          'points', item.points,
          'modeConfig', item.mode_config,
          'publicPayload', question.public_payload
        ) order by item.position
      )
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      join private.question_definitions question_definition on question_definition.id = question.question_definition_id
      where item.challenge_version_id = version.id
    ), '[]'::jsonb)
  )
  from private.challenge_versions version
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where version.id = target_challenge_version_id;
$function$;

CREATE OR REPLACE FUNCTION public.archive_superadmin_challenge_version (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.archive_challenge_version_command(input);
$function$;

REVOKE ALL ON FUNCTION "public"."archive_superadmin_challenge_version"(jsonb) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.create_superadmin_challenge_revision (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_challenge_revision_command(input);
$function$;

REVOKE ALL ON FUNCTION "public"."create_superadmin_challenge_revision"(jsonb) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_my_flash_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      a.id as own_attempt_id,
      a.status as own_attempt_status,
      a.score as own_attempt_score,
      a.started_at as own_attempt_started_at,
      a.completed_at as own_attempt_completed_at,
      a.deadline_at as own_attempt_deadline_at,
      a.lock_version as own_attempt_lock_version,
      cv.id as version_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer
    left join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = viewer.player_id and a.kind = 'competitive'
    where r.slug = target_room_slug
      and sc.id = target_publication_id
      and r.status = 'active'
      and m.player_id = viewer.player_id
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'member')
      and (
        private.publication_is_effectively_open(
          sc.status, s.status, s.starts_at, s.ends_at,
          sc.opens_at, sc.closes_at, statement_timestamp()
        )
        or a.id is not null
      )
      and cv.status in ('published', 'archived')
      and cv.mode = 'flash'
  )
  select
    p.room_id, p.room_slug, p.room_title, p.publication_id, p.publication_status,
    p.publication_opens_at, p.publication_closes_at, p.challenge_id, p.challenge_slug,
    p.challenge_version_id, p.challenge_title, p.challenge_subtitle, p.challenge_description,
    p.challenge_mode, p.challenge_max_score,
    count(i.id) over (partition by p.challenge_version_id),
    p.own_attempt_id, p.own_attempt_status, p.own_attempt_score, p.own_attempt_started_at,
    p.own_attempt_completed_at, p.own_attempt_deadline_at, p.own_attempt_lock_version,
    i.id, i.position, q.id, q.type, q.payload_schema_version,
    q.time_limit_ms, i.points
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_pyramid_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_version_number integer,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    level_id                 text,
    level_label              text,
    briefing_title           text,
    briefing_format          text,
    briefing_description     text,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.version_number as challenge_version_number,
      version.title as challenge_title, version.subtitle as challenge_subtitle,
      version.description as challenge_description, version.mode as challenge_mode,
      version.max_score as challenge_max_score,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status in ('published', 'archived') and version.mode = 'pyramid'
      and version.config_schema_version = 1 and version.mode_config = '{}'::jsonb
      and version.max_score = 100
      and (select count(*) from private.challenge_items item where item.challenge_version_id = version.id) = 7
      and (select count(*) from private.challenge_items item
        where item.challenge_version_id = version.id
          and item.position between 1 and 7 and item.config_schema_version = 1
          and private.is_valid_pyramid_level_config(item.mode_config)
          and private.is_supported_flash_question(item.question_version_id)) = 7
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_version_number, publication.challenge_title,
    publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, item.mode_config->>'levelId', item.mode_config->>'label',
    item.mode_config->'briefing'->>'title', item.mode_config->'briefing'->>'format',
    item.mode_config->'briefing'->>'description', question.id, question.type,
    question.payload_schema_version, question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_room_cards()
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    publication.competitive_playable,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path,
          'role', active_members.role
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count,
      (
        select (count(*) between 2 and 20 and cv.mode in ('flash', 'survival')
            or count(*) = 7 and cv.mode = 'pyramid')
          and bool_and(private.is_supported_flash_question(q.id))
          and (cv.mode = 'flash' and cv.mode_config = '{}'::jsonb
            or cv.mode = 'survival'
              and jsonb_typeof(cv.mode_config->'lives') = 'number'
              and (cv.mode_config->>'lives')::integer between 1 and count(*)
              and (select count(*) from jsonb_object_keys(cv.mode_config)) = 1
            or cv.mode = 'pyramid' and cv.mode_config = '{}'::jsonb
              and bool_and(private.is_valid_pyramid_level_config(items.mode_config))
              and count(distinct items.mode_config->>'levelId') = 7)
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status in ('published', 'archived')
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$function$;

CREATE OR REPLACE FUNCTION public.get_my_survival_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    initial_lives            integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.title as challenge_title,
      version.subtitle as challenge_subtitle, version.description as challenge_description,
      version.mode as challenge_mode, version.max_score as challenge_max_score,
      (version.mode_config->>'lives')::integer as initial_lives,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status in ('published', 'archived') and version.mode = 'survival'
      and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
      and jsonb_typeof(version.mode_config->'lives') = 'number'
      and (version.mode_config->>'lives')::integer between 1 and 20
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_title, publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score, publication.initial_lives,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, question.id, question.type, question.payload_schema_version,
    question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_room_calendar (
  target_room_slug text
)
  RETURNS TABLE (
    room_id             uuid,
    room_slug           text,
    room_title          text,
    time_zone           text,
    membership_role     text,
    season_id           uuid,
    season_title        text,
    season_status       text,
    publication_id      uuid,
    publication_number  integer,
    publication_status  text,
    availability_status text,
    opens_at            timestamp with time zone,
    closes_at           timestamp with time zone,
    challenge_title     text,
    challenge_subtitle  text,
    challenge_mode      text,
    question_count      bigint,
    own_attempt_status  text,
    can_start           boolean,
    can_continue        boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and (
      version.mode = 'flash' and version.mode_config = '{}'::jsonb
      or version.mode = 'survival'
        and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
        and jsonb_typeof(version.mode_config->'lives') = 'number'
        and (version.mode_config->>'lives')::integer between 1 and compatibility.question_count
      or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
        and compatibility.question_count = 7
    ) and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      (count(*) between 2 and 20 and version.mode in ('flash', 'survival')
        or count(*) = 7 and version.mode = 'pyramid')
        and coalesce(bool_and(item.position between 1 and case when version.mode = 'pyramid' then 7 else 20 end), false)
        and coalesce(bool_and(item.points > 0), false)
        and coalesce(bool_and(item.config_schema_version = 1 and (
          version.mode = 'pyramid' and private.is_valid_pyramid_level_config(item.mode_config)
          or version.mode <> 'pyramid' and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and count(*) filter (where private.is_supported_flash_question(question.id)) = count(*)
        and coalesce(sum(item.points), 0) = 100 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
    and version.mode in ('flash', 'survival', 'pyramid')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
$function$;

CREATE OR REPLACE FUNCTION public.get_room_introduction (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    membership_role      text,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    availability_status  text,
    can_start            boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select (count(*) between 2 and 20 and version.mode in ('flash', 'survival')
          or count(*) = 7 and version.mode = 'pyramid')
        and bool_and(private.is_supported_flash_question(question.id))
        and (version.mode = 'flash' and version.mode_config = '{}'::jsonb
          or version.mode = 'survival'
            and jsonb_typeof(version.mode_config->'lives') = 'number'
            and (version.mode_config->>'lives')::integer between 1 and count(*)
            and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
          or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
            and bool_and(private.is_valid_pyramid_level_config(item.mode_config))
            and count(distinct item.mode_config->>'levelId') = 7)
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status in ('published', 'archived')
  order by season.starts_at desc, schedule.number
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_attempt_inspection (
  target_room_id                uuid,
  target_scheduled_challenge_id uuid,
  target_attempt_id             uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    and version.mode in ('flash', 'alphabet', 'survival', 'pyramid');

  return inspection_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_attempt_publications (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
        and version.mode in ('flash', 'alphabet', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_calendar_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
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
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.status = 'active' and version.status in ('published', 'archived') and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_detail (
  target_challenge_definition_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  challenge_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'challengeVersionId', version.id,
          'versionNumber', version.version_number,
          'status', version.status,
          'slug', definition.slug,
          'title', version.title,
          'subtitle', version.subtitle,
          'description', version.description,
          'mode', version.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
          'createdAt', version.created_at,
          'updatedAt', version.updated_at,
          'publishedAt', version.published_at,
          'document', case when version.status = 'draft' then jsonb_build_object(
            'challenge', jsonb_build_object(
              'slug', definition.slug,
              'title', version.title,
              'subtitle', version.subtitle,
              'description', version.description,
              'mode', version.mode,
              'configSchemaVersion', version.config_schema_version,
              'modeConfig', version.mode_config
            ),
            'questions', coalesce((
              select jsonb_agg(
                case when question.status <> 'draft' then jsonb_build_object(
                  'source', 'library',
                  'questionVersionId', question.id,
                  'points', item.points,
                  'modeConfig', item.mode_config,
                  'challengeItemId', item.id
                ) else jsonb_build_object(
                  'slug', question_definition.slug,
                  'type', question.type,
                  'payloadSchemaVersion', question.payload_schema_version,
                  'timeLimitMs', question.time_limit_ms,
                  'points', item.points,
                  'publicPayload', question.public_payload,
                  'solutionPayload', solution.solution_payload
                ) || case when version.mode = 'pyramid'
                  then jsonb_build_object('modeConfig', item.mode_config) else '{}'::jsonb end end
                order by item.position
              )
              from private.challenge_items item
              join private.question_versions question on question.id = item.question_version_id
              join private.question_definitions question_definition on question_definition.id = question.question_definition_id
              join private.question_version_solutions solution on solution.question_version_id = question.id
              where item.challenge_version_id = version.id
            ), '[]'::jsonb)
          ) else null end
        ) order by version.updated_at desc, version.id
      )
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    );

  return challenge_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_version_comparison (
  from_challenge_version_id uuid,
  to_challenge_version_id   uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  from_definition_id uuid;
  to_definition_id uuid;
  from_mode text;
  to_mode text;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if from_challenge_version_id is null or to_challenge_version_id is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  select version.challenge_definition_id, version.mode
    into from_definition_id, from_mode
  from private.challenge_versions version
  where version.id = from_challenge_version_id;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  select version.challenge_definition_id, version.mode
    into to_definition_id, to_mode
  from private.challenge_versions version
  where version.id = to_challenge_version_id;
  if not found then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if from_definition_id <> to_definition_id then
    raise exception 'invalid_comparison' using errcode = '22023';
  end if;
  if from_mode not in ('flash', 'survival', 'pyramid') or to_mode not in ('flash', 'survival', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'challengeDefinitionId', from_definition_id,
    'from', private.superadmin_challenge_version_snapshot(from_challenge_version_id),
    'to', private.superadmin_challenge_version_snapshot(to_challenge_version_id)
  );
end;
$function$;

REVOKE ALL ON FUNCTION "public"."get_superadmin_challenge_version_comparison"(uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'metrics', jsonb_build_object(
      'activeRooms', (
        select count(*)
        from public.rooms room
        where room.status = 'active'
      ),
      'activeSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status = 'active'
      ),
      'pendingSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status in ('draft', 'scheduled')
      ),
      'editorialDrafts', (
        select count(*)
        from private.challenge_versions version
        where version.mode in ('flash', 'survival', 'pyramid') and version.status = 'draft'
      ),
      'upcomingChallenges', (
        select count(*)
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'pyramid')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
      )
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasonCount', (
            select count(*)
            from public.seasons season_count
            where season_count.room_id = room.id
          ),
          'activeSeason', (
            select jsonb_build_object(
              'title', season.title,
              'startsAt', season.starts_at,
              'endsAt', season.ends_at
            )
            from public.seasons season
            where season.room_id = room.id and season.status = 'active'
            order by season.starts_at desc, season.id
            limit 1
          )
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb),
    'upcomingChallenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduledChallengeId', upcoming.scheduled_challenge_id,
          'roomId', upcoming.room_id,
          'roomTitle', upcoming.room_title,
          'seasonId', upcoming.season_id,
          'seasonTitle', upcoming.season_title,
          'challengeVersionId', upcoming.challenge_version_id,
          'challengeTitle', upcoming.challenge_title,
          'number', upcoming.challenge_number,
          'status', upcoming.challenge_status,
          'opensAt', upcoming.opens_at,
          'closesAt', upcoming.closes_at,
          'timeZone', upcoming.time_zone
        ) order by upcoming.opens_at, upcoming.scheduled_challenge_id
      )
      from (
        select
          schedule.id as scheduled_challenge_id,
          room.id as room_id,
          room.title as room_title,
          season.id as season_id,
          season.title as season_title,
          version.id as challenge_version_id,
          version.title as challenge_title,
          schedule.number as challenge_number,
          schedule.status as challenge_status,
          schedule.opens_at,
          schedule.closes_at,
          room.time_zone
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'pyramid')
          and version.status in ('published', 'archived')
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
        order by schedule.opens_at, schedule.id
        limit 5
      ) upcoming
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_attempts (
  target_room_id                uuid,
  target_scheduled_challenge_id uuid,
  cursor_started_at             timestamp with time zone,
  cursor_attempt_id             uuid,
  page_size                     integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_calendar_context (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
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
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status in ('published', 'archived')
        and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

REVOKE ALL ON FUNCTION "private"."archive_challenge_version_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."archive_challenge_version_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_challenge_revision_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_challenge_revision_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."superadmin_challenge_version_snapshot"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."superadmin_challenge_version_snapshot"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."archive_superadmin_challenge_version"(jsonb) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_challenge_revision"(jsonb) TO "authenticated", "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_challenge_version_comparison"(uuid, uuid) TO "authenticated", "postgres";
