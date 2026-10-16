-- Transactional question draft, publication and archive commands.
set local check_function_bodies = off;

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
    version_id, definition_id, next_version, (document_value->>'payloadSchemaVersion')::integer, 'draft',
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
alter function private.create_question_draft_command(jsonb) owner to postgres;
revoke all on function private.create_question_draft_command(jsonb) from public, anon, authenticated, service_role;

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
alter function private.update_question_draft_command(jsonb) owner to postgres;
revoke all on function private.update_question_draft_command(jsonb) from public, anon, authenticated, service_role;

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
alter function private.publish_question_command(jsonb) owner to postgres;
revoke all on function private.publish_question_command(jsonb) from public, anon, authenticated, service_role;

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
alter function private.archive_question_command(jsonb) owner to postgres;
revoke all on function private.archive_question_command(jsonb) from public, anon, authenticated, service_role;

create or replace function public.create_superadmin_question_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.create_question_draft_command(input); $$;
alter function public.create_superadmin_question_draft(jsonb) owner to postgres;
revoke all on function public.create_superadmin_question_draft(jsonb) from public, anon, service_role;
grant execute on function public.create_superadmin_question_draft(jsonb) to authenticated;

create or replace function public.update_superadmin_question_draft(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.update_question_draft_command(input); $$;
alter function public.update_superadmin_question_draft(jsonb) owner to postgres;
revoke all on function public.update_superadmin_question_draft(jsonb) from public, anon, service_role;
grant execute on function public.update_superadmin_question_draft(jsonb) to authenticated;

create or replace function public.publish_superadmin_question(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.publish_question_command(input); $$;
alter function public.publish_superadmin_question(jsonb) owner to postgres;
revoke all on function public.publish_superadmin_question(jsonb) from public, anon, service_role;
grant execute on function public.publish_superadmin_question(jsonb) to authenticated;

create or replace function public.archive_superadmin_question(input jsonb) returns jsonb
language sql volatile security definer set search_path = '' as $$ select private.archive_question_command(input); $$;
alter function public.archive_superadmin_question(jsonb) owner to postgres;
revoke all on function public.archive_superadmin_question(jsonb) from public, anon, service_role;
grant execute on function public.archive_superadmin_question(jsonb) to authenticated;
