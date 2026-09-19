-- D08b: server-only lifecycle and authorization for private question assets.
set local check_function_bodies = off;

create function private.prepare_question_asset_upload_command(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := btrim(input->>'idempotencyKey');
  asset uuid := (input->>'assetId')::uuid;
  object_path_value text := input->>'objectPath';
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','objectPath','mimeType','byteSize']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','objectPath','mimeType','byteSize']))
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg','image/png','image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 52428800
    or object_path_value !~ ('^question-assets/' || asset::text || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_question_asset_upload' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'assetId', asset, 'objectPath', object_path_value,
    'mimeType', mime_value, 'byteSize', bytes_value);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-upload:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'prepare_question_asset_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  insert into private.media_assets(id, bucket_id, object_path, kind, owner_player_id, created_by_player_id)
  values (asset, 'question-assets', object_path_value, 'question-asset', null, actor);
  result := jsonb_build_object('assetId', asset, 'objectPath', object_path_value, 'status', 'pending');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'prepare_question_asset_upload', 'media_asset', asset, key,
    jsonb_build_object('bucketId','question-assets','objectPath',object_path_value,'status','pending'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'prepare_question_asset_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$$;

create function private.read_question_asset_upload(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result from private.media_assets asset
    where asset.id = (input->>'assetId')::uuid and asset.kind = 'question-asset';
  return result;
exception when invalid_text_representation then return null;
end;
$$;

create function private.confirm_question_asset_upload_command(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor(); key text := btrim(input->>'idempotencyKey');
  target_asset uuid := (input->>'assetId')::uuid; asset_row private.media_assets%rowtype;
  mime_value text := input->>'mimeType'; bytes_value bigint := (input->>'byteSize')::bigint;
  width_value integer := (input->>'width')::integer; height_value integer := (input->>'height')::integer;
  hash_value text := lower(btrim(input->>'sha256')); cached private.command_requests%rowtype;
  safe_input jsonb; result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']))
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg','image/png','image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 52428800
    or width_value is null or width_value not between 1 and 8192
    or height_value is null or height_value not between 1 and 8192
    or hash_value !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_question_asset_upload' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey',key,'assetId',target_asset,'mimeType',mime_value,'byteSize',bytes_value,
    'width',width_value,'height',height_value,'sha256',hash_value);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-confirm:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'confirm_question_asset_upload' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into asset_row from private.media_assets row_asset where row_asset.id = target_asset and row_asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status <> 'pending' then raise exception 'media_asset_not_pending' using errcode = '55000'; end if;
  update private.media_assets set status = 'ready', mime_type = mime_value, byte_size = bytes_value,
    width = width_value, height = height_value, sha256 = hash_value where id = target_asset;
  result := jsonb_build_object('assetId',target_asset,'objectPath',asset_row.object_path,'status','ready');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'confirm_question_asset_upload', 'media_asset', target_asset, key,
    jsonb_build_object('status','ready','mimeType',mime_value,'byteSize',bytes_value,'width',width_value,'height',height_value));
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result)
  values (actor,key,'confirm_question_asset_upload',safe_input,result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$$;

create function private.abort_question_asset_upload_command(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); row_value private.media_assets%rowtype;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into row_value from private.media_assets asset where asset.id = (input->>'assetId')::uuid and asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if row_value.status = 'pending' then
    update private.media_assets set status = 'deleted', deleted_at = statement_timestamp() where id = row_value.id;
    row_value.status := 'deleted';
  end if;
  return jsonb_build_object('assetId',row_value.id,'objectPath',row_value.object_path,'status',row_value.status);
exception when invalid_text_representation then raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$$;

create function private.archive_question_asset_command(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.command_actor();
  key text := btrim(input->>'idempotencyKey');
  reason text := btrim(input->>'reason');
  target_asset uuid := (input->>'assetId')::uuid;
  asset_row private.media_assets%rowtype;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','reason']))
    or key is null or char_length(key) not between 8 and 160
    or reason is null or char_length(reason) not between 1 and 500 then
    raise exception 'invalid_question_asset_archive' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'assetId', target_asset, 'reason', reason);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-archive:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_question_asset' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into asset_row from private.media_assets asset where asset.id = target_asset and asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status not in ('ready', 'archived') then raise exception 'media_asset_not_archivable' using errcode = '55000'; end if;
  update private.media_assets set status = 'archived', archived_at = statement_timestamp() where id = target_asset;
  result := jsonb_build_object('assetId', target_asset, 'objectPath', asset_row.object_path, 'status', 'archived');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, reason, after_payload)
  values (actor, 'archive_question_asset', 'media_asset', target_asset, key, reason, jsonb_build_object('status','archived'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_question_asset', safe_input, result);
  return result;
exception when invalid_text_representation then
  raise exception 'invalid_question_asset_archive' using errcode = '22023';
end;
$$;

-- A competitive or historical owner may resolve only an asset referenced by their own attempt.
create function private.read_competitive_question_asset(input jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result
  from public.attempts attempt
  join private.challenge_items item on item.challenge_version_id = attempt.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  join private.media_assets asset on asset.id = coalesce(
    question.public_payload->'surface'->>'assetId',
    question.public_payload->'media'->>'assetId'
  )::uuid
  where attempt.id = (input->>'attemptId')::uuid
    and attempt.player_id = actor and attempt.kind = 'competitive'
    and item.question_version_id is not null
    and question.payload_schema_version = 2
    and (
      (question.type = 'progressive-image' and question.public_payload->'surface' ? 'assetId')
      or (question.type = 'multiple-choice' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'estimation' and question.public_payload->'media' ? 'assetId')
    )
    and asset.kind = 'question-asset' and asset.status in ('ready','archived')
    and asset.id = (input->>'assetId')::uuid;
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
exception when invalid_text_representation then raise exception 'not_authorized' using errcode = '42501';
end;
$$;

alter function private.prepare_question_asset_upload_command(jsonb) owner to postgres;
alter function private.read_question_asset_upload(jsonb) owner to postgres;
alter function private.confirm_question_asset_upload_command(jsonb) owner to postgres;
alter function private.abort_question_asset_upload_command(jsonb) owner to postgres;
alter function private.archive_question_asset_command(jsonb) owner to postgres;
alter function private.read_competitive_question_asset(jsonb) owner to postgres;
revoke all on function private.prepare_question_asset_upload_command(jsonb), private.read_question_asset_upload(jsonb),
  private.confirm_question_asset_upload_command(jsonb), private.abort_question_asset_upload_command(jsonb),
  private.archive_question_asset_command(jsonb),
  private.read_competitive_question_asset(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_question_asset_upload_command(jsonb), private.read_question_asset_upload(jsonb),
  private.confirm_question_asset_upload_command(jsonb), private.abort_question_asset_upload_command(jsonb),
  private.archive_question_asset_command(jsonb),
  private.read_competitive_question_asset(jsonb) to service_role;
