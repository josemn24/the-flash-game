-- S17 — Correct published editorial content by creating a new challenge version.
-- Published challenge graphs remain immutable. A revision copies only the challenge
-- graph and keeps references to the published question versions selected by it.

set local check_function_bodies = off;


create function private.create_challenge_revision_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
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
  if source_row.mode not in ('flash', 'survival', 'narrative', 'pyramid') then
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
$$;

create function private.archive_challenge_version_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
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
  if version_row.mode not in ('flash', 'survival', 'narrative', 'pyramid') then
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
$$;

create function private.superadmin_challenge_version_snapshot(target_challenge_version_id uuid)
returns jsonb
language sql stable set search_path = '' as $$
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
$$;

create function public.get_superadmin_challenge_version_comparison(
  from_challenge_version_id uuid,
  to_challenge_version_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
  if from_mode not in ('flash', 'survival', 'narrative', 'pyramid') or to_mode not in ('flash', 'survival', 'narrative', 'pyramid') then
    raise exception 'unsupported_mode' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'challengeDefinitionId', from_definition_id,
    'from', private.superadmin_challenge_version_snapshot(from_challenge_version_id),
    'to', private.superadmin_challenge_version_snapshot(to_challenge_version_id)
  );
end;
$$;

create function public.create_superadmin_challenge_revision(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.create_challenge_revision_command(input);
$$;

create function public.archive_superadmin_challenge_version(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.archive_challenge_version_command(input);
$$;

alter function private.create_challenge_revision_command(jsonb) owner to postgres;
alter function private.archive_challenge_version_command(jsonb) owner to postgres;
alter function private.superadmin_challenge_version_snapshot(uuid) owner to postgres;
alter function public.get_superadmin_challenge_version_comparison(uuid, uuid) owner to postgres;
alter function public.create_superadmin_challenge_revision(jsonb) owner to postgres;
alter function public.archive_superadmin_challenge_version(jsonb) owner to postgres;

revoke all on function private.create_challenge_revision_command(jsonb),
  private.archive_challenge_version_command(jsonb),
  private.superadmin_challenge_version_snapshot(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_superadmin_challenge_version_comparison(uuid, uuid),
  public.create_superadmin_challenge_revision(jsonb),
  public.archive_superadmin_challenge_version(jsonb)
  from public, anon, service_role;
grant execute on function public.get_superadmin_challenge_version_comparison(uuid, uuid),
  public.create_superadmin_challenge_revision(jsonb),
  public.archive_superadmin_challenge_version(jsonb) to authenticated;
