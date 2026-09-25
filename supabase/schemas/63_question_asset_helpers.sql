-- D08b: database-side checks for private question assets.
create or replace function private.is_ready_question_asset(target_asset uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.media_assets asset
    where asset.id = target_asset
      and asset.bucket_id = 'question-assets'
      and asset.kind = 'question-asset'
      and asset.status = 'ready'
      and asset.mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and asset.byte_size between 1 and 52428800
      and asset.width between 1 and 8192
      and asset.height between 1 and 8192
      and asset.sha256 ~ '^[0-9a-f]{64}$'
  );
$$;

alter function private.is_ready_question_asset(uuid) owner to postgres;
revoke all on function private.is_ready_question_asset(uuid) from public, anon, authenticated, service_role;

create or replace function private.is_usable_question_asset(target_asset uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.media_assets asset
    where asset.id = target_asset
      and asset.bucket_id = 'question-assets'
      and asset.kind = 'question-asset'
      and asset.status in ('ready', 'archived')
      and asset.mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and asset.byte_size between 1 and 52428800
      and asset.width between 1 and 8192
      and asset.height between 1 and 8192
      and asset.sha256 ~ '^[0-9a-f]{64}$'
  );
$$;

alter function private.is_usable_question_asset(uuid) owner to postgres;
revoke all on function private.is_usable_question_asset(uuid) from public, anon, authenticated, service_role;
