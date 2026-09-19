-- S17a — Independent Flash question library.
-- Question versions remain immutable once published; challenge_items select them.

set local check_function_bodies = off;

create unique index if not exists challenge_items_question_version_unique_idx
  on private.challenge_items (challenge_version_id, question_version_id);

create index if not exists question_versions_library_idx
  on private.question_versions (status, type, updated_at desc, id);

create or replace function private.validate_flash_question_document(document jsonb) returns void
language plpgsql volatile set search_path = '' as $$
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug', 'question-library-validation',
      'title', 'Question library validation',
      'subtitle', '',
      'description', '',
      'mode', 'flash',
      'configSchemaVersion', 1,
      'modeConfig', '{}'::jsonb
    ),
    'questions', jsonb_build_array(
      document || jsonb_build_object('points', 50),
      document || jsonb_build_object(
        'slug', (document->>'slug') || '-validation-copy',
        'points', 50
      )
    )
  ));
end;
$$;

create or replace function private.question_version_document(target_question_version uuid)
returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'slug', definition.slug,
    'type', version.type,
    'payloadSchemaVersion', version.payload_schema_version,
    'timeLimitMs', version.time_limit_ms,
    'publicPayload', version.public_payload,
    'solutionPayload', solution.solution_payload
  )
  from private.question_versions version
  join private.question_definitions definition on definition.id = version.question_definition_id
  join private.question_version_solutions solution on solution.question_version_id = version.id
  where version.id = target_question_version;
$$;

create or replace function private.question_version_detail(target_question_version uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  definition_row private.question_definitions%rowtype;
  result jsonb;
begin
  select definition.* into definition_row
  from private.question_definitions definition
  join private.question_versions version on version.question_definition_id = definition.id
  where version.id = target_question_version;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'questionDefinitionId', definition_row.id,
    'slug', definition_row.slug,
    'versions', coalesce(jsonb_agg(
      jsonb_build_object(
        'questionDefinitionId', version.question_definition_id,
        'questionVersionId', version.id,
        'versionNumber', version.version_number,
        'status', version.status,
        'slug', definition_row.slug,
        'type', version.type,
        'question', version.public_payload->>'question',
        'category', version.public_payload->>'category',
        'tags', coalesce(version.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', version.time_limit_ms,
        'createdAt', version.created_at,
        'updatedAt', version.updated_at,
        'publishedAt', version.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = version.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = version.id),
        'document', private.question_version_document(version.id)
      ) order by version.version_number desc
    ), '[]'::jsonb)
  ) into result
  from private.question_versions version
  where version.question_definition_id = definition_row.id;
  return result;
end;
$$;

create or replace function private.read_superadmin_question_library(input jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  page_value integer := greatest(1, least(coalesce((input->>'page')::integer, 1), 10000));
  page_size_value integer := greatest(1, least(coalesce((input->>'pageSize')::integer, 25), 100));
  search_value text := nullif(btrim(input->>'search'), '');
  type_value text := nullif(btrim(input->>'type'), '');
  status_value text := coalesce(nullif(btrim(input->>'status'), ''), 'published');
  tag_value text := nullif(btrim(input->>'tag'), '');
  total_value integer;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['page', 'pageSize', 'search', 'type', 'status', 'tag']))
    or status_value not in ('all', 'draft', 'published', 'archived') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  with candidates as (
    select version.id, row_number() over (
      partition by version.question_definition_id order by version.version_number desc, version.id desc
    ) as latest_version
    from private.question_versions version
    join private.question_definitions definition on definition.id = version.question_definition_id
    where (status_value = 'all' or version.status = status_value)
      and (type_value is null or version.type = type_value)
      and (search_value is null or definition.slug ilike '%' || search_value || '%'
        or version.public_payload->>'question' ilike '%' || search_value || '%')
      and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
  )
  select count(*) into total_value
  from candidates
  where status_value <> 'published' or latest_version = 1;

  return jsonb_build_object(
    'entries', coalesce((
      with candidates as (
        select version.*, definition.slug, row_number() over (
          partition by version.question_definition_id order by version.version_number desc, version.id desc
        ) as latest_version
        from private.question_versions version
        join private.question_definitions definition on definition.id = version.question_definition_id
        where (status_value = 'all' or version.status = status_value)
          and (type_value is null or version.type = type_value)
          and (search_value is null or definition.slug ilike '%' || search_value || '%'
            or version.public_payload->>'question' ilike '%' || search_value || '%')
          and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
      )
      select jsonb_agg(jsonb_build_object(
        'questionDefinitionId', candidate.question_definition_id,
        'questionVersionId', candidate.id,
        'versionNumber', candidate.version_number,
        'status', candidate.status,
        'slug', candidate.slug,
        'type', candidate.type,
        'question', candidate.public_payload->>'question',
        'category', candidate.public_payload->>'category',
        'tags', coalesce(candidate.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', candidate.time_limit_ms,
        'createdAt', candidate.created_at,
        'updatedAt', candidate.updated_at,
        'publishedAt', candidate.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = candidate.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = candidate.id)
      ) order by candidate.updated_at desc, candidate.id
      ) from candidates candidate
      where status_value <> 'published' or candidate.latest_version = 1
      offset (page_value - 1) * page_size_value limit page_size_value
    ), '[]'::jsonb),
    'total', total_value,
    'page', page_value,
    'pageSize', page_size_value
  );
end;
$$;

create or replace function private.create_question_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  definition_id uuid;
  version_id uuid := gen_random_uuid();
  next_version integer;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'questionDefinitionId', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'questionDefinitionId', input->'questionDefinitionId',
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'),
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  if input ? 'questionDefinitionId' and input->>'questionDefinitionId' is not null then
    definition_id := (input->>'questionDefinitionId')::uuid;
    perform 1 from private.question_definitions where id = definition_id for update;
    if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
    if (select slug from private.question_definitions where id = definition_id) <> document_value->>'slug' then
      raise exception 'content_slug_conflict' using errcode = '23505';
    end if;
    select coalesce(max(version_number), 0) + 1 into next_version
    from private.question_versions where question_definition_id = definition_id;
  else
    definition_id := gen_random_uuid();
    next_version := 1;
    insert into private.question_definitions(id, slug, created_by_player_id)
    values (definition_id, document_value->>'slug', actor);
  end if;

  insert into private.question_versions(
    id, question_definition_id, version_number, payload_schema_version, status,
    type, time_limit_ms, public_payload, created_by_player_id
  ) values (
    version_id, definition_id, next_version, document_value->>'payloadSchemaVersion', 'draft',
    document_value->>'type', (document_value->>'timeLimitMs')::integer,
    document_value->'publicPayload', actor
  );
  insert into private.question_version_solutions(question_version_id, solution_payload)
  values (version_id, document_value->'solutionPayload');
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    after_payload) values (actor, 'create_question_draft', 'question_version', version_id, reason_value, key, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_question_draft', safe_input, result);
  return result;
exception when unique_violation then
  raise exception 'content_slug_conflict' using errcode = '23505';
end;
$$;

create or replace function private.update_question_draft_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  document_value jsonb := input->'document';
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  definition_row private.question_definitions%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array[
      'idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id,
    'expectedUpdatedAt', expected_updated_at,
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'), 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.question_definitions definition
  where definition.id = version_row.question_definition_id for update;
  if definition_row.slug <> document_value->>'slug' then raise exception 'content_slug_conflict' using errcode = '23505'; end if;
  update private.question_versions set type = document_value->>'type',
    payload_schema_version = (document_value->>'payloadSchemaVersion')::integer,
    time_limit_ms = (document_value->>'timeLimitMs')::integer,
    public_payload = document_value->'publicPayload'
  where id = version_id;
  update private.question_version_solutions set solution_payload = document_value->'solutionPayload'
  where question_version_id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'update_question_draft', 'question_version', version_id,
    reason_value, key, jsonb_build_object('updatedAt', version_row.updated_at), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_question_draft', safe_input, result);
  return result;
end;
$$;

create or replace function private.publish_question_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  result jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'reason'] then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id, 'expectedUpdatedAt', expected_updated_at, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'publish_question' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status = 'published' then raise exception 'content_already_published' using errcode = '55000'; end if;
  if version_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  perform private.validate_flash_question_document(private.question_version_document(version_id));
  update private.question_versions set status = 'published', published_at = clock_timestamp() where id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'publish_question', 'question_version', version_id, reason_value, key,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'published', 'version', result));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_question', safe_input, result);
  return result;
end;
$$;

create or replace function private.archive_question_command(input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  result jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object' or
    not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'reason'] then raise exception 'invalid_command' using errcode = '22023'; end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id, 'expectedUpdatedAt', expected_updated_at, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_question' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status <> 'published' then raise exception 'content_not_published' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  update private.question_versions set status = 'archived' where id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'archive_question', 'question_version', version_id, reason_value, key,
    jsonb_build_object('status', 'published'), jsonb_build_object('status', 'archived'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_question', safe_input, result);
  return result;
end;
$$;

create or replace function public.get_superadmin_question_library(input jsonb default '{}'::jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.read_superadmin_question_library(input); $$;
create or replace function public.get_superadmin_question_version(question_version_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.question_version_detail(question_version_id);
$$;
create or replace function public.create_superadmin_question_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.create_question_draft_command(input); $$;
create or replace function public.update_superadmin_question_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.update_question_draft_command(input); $$;
create or replace function public.publish_superadmin_question(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.publish_question_command(input); $$;
create or replace function public.archive_superadmin_question(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.archive_question_command(input); $$;

alter function private.validate_flash_question_document(jsonb) owner to postgres;
alter function private.question_version_document(uuid) owner to postgres;
alter function private.question_version_detail(uuid) owner to postgres;
alter function private.read_superadmin_question_library(jsonb) owner to postgres;
alter function private.create_question_draft_command(jsonb) owner to postgres;
alter function private.update_question_draft_command(jsonb) owner to postgres;
alter function private.publish_question_command(jsonb) owner to postgres;
alter function private.archive_question_command(jsonb) owner to postgres;
alter function public.get_superadmin_question_library(jsonb) owner to postgres;
alter function public.get_superadmin_question_version(uuid) owner to postgres;
alter function public.create_superadmin_question_draft(jsonb) owner to postgres;
alter function public.update_superadmin_question_draft(jsonb) owner to postgres;
alter function public.publish_superadmin_question(jsonb) owner to postgres;
alter function public.archive_superadmin_question(jsonb) owner to postgres;

revoke all on function private.validate_flash_question_document(jsonb), private.question_version_document(uuid),
  private.question_version_detail(uuid), private.read_superadmin_question_library(jsonb),
  private.create_question_draft_command(jsonb), private.update_question_draft_command(jsonb),
  private.publish_question_command(jsonb), private.archive_question_command(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.get_superadmin_question_library(jsonb), public.get_superadmin_question_version(uuid),
  public.create_superadmin_question_draft(jsonb), public.update_superadmin_question_draft(jsonb),
  public.publish_superadmin_question(jsonb), public.archive_superadmin_question(jsonb)
  from public, anon, service_role;
grant execute on function public.get_superadmin_question_library(jsonb), public.get_superadmin_question_version(uuid),
  public.create_superadmin_question_draft(jsonb), public.update_superadmin_question_draft(jsonb),
  public.publish_superadmin_question(jsonb), public.archive_superadmin_question(jsonb) to authenticated;
