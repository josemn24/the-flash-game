SET local check_function_bodies = off;

CREATE TABLE "private"."media_assets" (
  "id"                   uuid                     NOT NULL,
  "bucket_id"            text                     NOT NULL,
  "object_path"          text                     NOT NULL,
  "kind"                 text                     NOT NULL,
  "status"               text                     NOT NULL DEFAULT 'pending'::text,
  "owner_player_id"      uuid,
  "created_by_player_id" uuid                     NOT NULL,
  "mime_type"            text,
  "byte_size"            bigint,
  "width"                integer,
  "height"               integer,
  "sha256"               text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at"          timestamp with time zone,
  "deleted_at"           timestamp with time zone,
  CONSTRAINT "media_assets_bucket_id_check" CHECK ((bucket_id = ANY (ARRAY['avatars'::text, 'question-assets'::text]))),
  CONSTRAINT "media_assets_byte_size_check" CHECK (((byte_size IS NULL) OR (byte_size > 0))),
  CONSTRAINT "media_assets_check1" CHECK (((status <> 'ready'::text) OR ((mime_type IS NOT NULL) AND (byte_size IS NOT NULL) AND (width IS NOT NULL) AND (height IS
    NOT NULL) AND (sha256 IS NOT NULL)))),
  CONSTRAINT "media_assets_check2" CHECK (((status = 'archived'::text) = (archived_at IS NOT NULL))),
  CONSTRAINT "media_assets_check3" CHECK (((status = 'deleted'::text) = (deleted_at IS NOT NULL))),
  CONSTRAINT "media_assets_check" CHECK ((((kind = 'avatar'::text) AND (bucket_id = 'avatars'::text) AND (owner_player_id IS
    NOT NULL) AND (object_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$'::text)) OR
    ((kind = 'question-asset'::text) AND (bucket_id = 'question-assets'::text) AND (object_path ~~ 'question-assets/%'::text)))),
  CONSTRAINT "media_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "media_assets_kind_check" CHECK ((kind = ANY (ARRAY['avatar'::text, 'question-asset'::text]))),
  CONSTRAINT "media_assets_mime_type_check" CHECK (((mime_type IS NULL) OR (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))),
  CONSTRAINT "media_assets_object_path_key" UNIQUE (object_path),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_assets_sha256_check" CHECK (((sha256 IS NULL) OR (sha256 ~ '^[0-9a-f]{64}$'::text))),
  CONSTRAINT "media_assets_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'archived'::text, 'deleted'::text]))),
  CONSTRAINT "media_assets_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "private"."media_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.abort_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  asset uuid := (input->>'assetId')::uuid;
  row_value private.media_assets%rowtype;
begin
  select * into row_value from private.media_assets
  where id = asset and owner_player_id = actor for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if row_value.status = 'pending' then
    update private.media_assets set status = 'deleted', deleted_at = statement_timestamp()
    where id = asset;
    row_value.status := 'deleted';
  end if;
  return jsonb_build_object('assetId', row_value.id, 'objectPath', row_value.object_path, 'status', row_value.status);
exception when invalid_text_representation then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.confirm_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  asset uuid;
  asset_row private.media_assets%rowtype;
  old_path text;
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  width_value integer := (input->>'width')::integer;
  height_value integer := (input->>'height')::integer;
  hash_value text := lower(btrim(input->>'sha256'));
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  player_row public.players%rowtype;
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']))
    or not input ?& array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']
    or key is null or char_length(key) not between 8 and 160
    or input->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or mime_value not in ('image/jpeg', 'image/png', 'image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 5242880
    or width_value is null or width_value <= 0 or width_value > 2048
    or height_value is null or height_value <= 0 or height_value > 2048
    or hash_value !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_avatar_upload' using errcode = '22023';
  end if;
  asset := (input->>'assetId')::uuid;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'assetId', asset, 'mimeType', mime_value,
    'byteSize', bytes_value, 'width', width_value, 'height', height_value, 'sha256', hash_value
  );

  perform pg_advisory_xact_lock(hashtextextended('avatar-confirm:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'confirm_avatar_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into asset_row from private.media_assets
  where id = asset and owner_player_id = actor for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status <> 'pending' then
    raise exception 'media_asset_not_pending' using errcode = '55000';
  end if;

  select * into player_row from public.players where id = actor and status = 'active' for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  old_path := player_row.avatar_path;
  update private.media_assets
  set status = 'ready', mime_type = mime_value, byte_size = bytes_value,
      width = width_value, height = height_value, sha256 = hash_value
  where id = asset;
  update public.players set avatar_path = asset_row.object_path where id = actor;
  update private.media_assets
  set status = 'archived', archived_at = statement_timestamp()
  where owner_player_id = actor and object_path = old_path and id <> asset and status = 'ready';

  result := jsonb_build_object(
    'assetId', asset, 'objectPath', asset_row.object_path, 'oldObjectPath', old_path,
    'profile', jsonb_build_object('playerId', player_row.id, 'name', player_row.display_name,
      'avatarPath', asset_row.object_path)
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
  values (actor, 'confirm_avatar_upload', 'media_asset', asset, key,
    jsonb_build_object('avatarPath', old_path),
    jsonb_build_object('avatarPath', asset_row.object_path, 'byteSize', bytes_value,
      'width', width_value, 'height', height_value, 'mimeType', mime_value));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'confirm_avatar_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.prepare_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  asset uuid;
  object_path_value text := input->>'objectPath';
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','assetId','objectPath','mimeType','byteSize']))
    or not input ?& array['idempotencyKey','assetId','objectPath','mimeType','byteSize']
    or input->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg', 'image/png', 'image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 5242880 then
    raise exception 'invalid_avatar_upload' using errcode = '22023';
  end if;

  asset := (input->>'assetId')::uuid;
  if object_path_value !~ ('^avatars/' || actor::text || '/' || asset::text || '\\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_avatar_path' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'assetId', asset, 'objectPath', object_path_value,
    'mimeType', mime_value, 'byteSize', bytes_value
  );

  perform pg_advisory_xact_lock(hashtextextended('avatar-upload:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'prepare_avatar_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  insert into private.media_assets(
    id, bucket_id, object_path, kind, owner_player_id, created_by_player_id
  ) values (
    asset, 'avatars', object_path_value, 'avatar', actor, actor
  );

  result := jsonb_build_object(
    'assetId', asset, 'objectPath', object_path_value, 'status', 'pending'
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'prepare_avatar_upload', 'media_asset', asset, key,
    jsonb_build_object('bucketId', 'avatars', 'objectPath', object_path_value, 'status', 'pending'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'prepare_avatar_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_avatar_upload_asset (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  asset uuid := (input->>'assetId')::uuid;
  result jsonb;
begin
  select jsonb_build_object(
    'assetId', id, 'objectPath', object_path, 'status', status
  ) into result
  from private.media_assets
  where id = asset and owner_player_id = actor;
  return result;
exception when invalid_text_representation then
  return null;
end;
$function$;

ALTER TABLE "private"."media_assets"
  ADD CONSTRAINT "media_assets_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."media_assets"
  ADD CONSTRAINT "media_assets_owner_player_id_fkey" FOREIGN KEY (owner_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

CREATE INDEX media_assets_bucket_path_idx ON private.media_assets USING btree (bucket_id, object_path);

CREATE INDEX media_assets_owner_status_idx ON private.media_assets USING btree (owner_player_id, status, updated_at DESC);

CREATE TRIGGER media_assets_touch_updated_at
  BEFORE UPDATE ON private.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE POLICY "storage_avatars_public_read" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'avatars'::text));

CREATE POLICY "storage_question_assets_private" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (false);

REVOKE ALL ON FUNCTION "private"."abort_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."abort_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."confirm_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."confirm_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."prepare_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."prepare_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_avatar_upload_asset"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_avatar_upload_asset"(jsonb) TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."media_assets" TO "postgres";

GRANT SELECT ON TABLE "private"."media_assets" TO "service_role";
