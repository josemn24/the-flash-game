SET local check_function_bodies = off;

ALTER TABLE "private"."media_assets"
  DROP CONSTRAINT "media_assets_check";

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
  if object_path_value !~ ('^avatars/' || actor::text || '/' || asset::text || '\.(jpg|jpeg|png|webp)$') then
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

ALTER TABLE "private"."media_assets"
  ADD CONSTRAINT "media_assets_check" CHECK ((((kind = 'avatar'::text) AND (bucket_id = 'avatars'::text) AND (owner_player_id IS
    NOT NULL) AND (object_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'::text)) OR
    ((kind = 'question-asset'::text) AND (bucket_id = 'question-assets'::text) AND (object_path ~~ 'question-assets/%'::text))));
