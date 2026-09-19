SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.archive_question_asset_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  update private.media_assets set status = 'archived' where id = target_asset;
  result := jsonb_build_object('assetId', target_asset, 'objectPath', asset_row.object_path, 'status', 'archived');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, reason, after_payload)
  values (actor, 'archive_question_asset', 'media_asset', target_asset, key, reason, jsonb_build_object('status','archived'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_question_asset', safe_input, result);
  return result;
exception when invalid_text_representation then
  raise exception 'invalid_question_asset_archive' using errcode = '22023';
end;
$function$;

REVOKE ALL ON FUNCTION "private"."archive_question_asset_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."archive_question_asset_command"(jsonb) TO "postgres", "service_role";
