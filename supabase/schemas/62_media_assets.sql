-- D08a/S13: registry for server-confirmed media objects.
-- Object bytes are owned by Supabase Storage; this table is the authoritative
-- lifecycle and business-ownership record. It is deliberately private.
create table private.media_assets (
  id uuid primary key,
  bucket_id text not null check (bucket_id in ('avatars', 'question-assets')),
  object_path text not null unique,
  kind text not null check (kind in ('avatar', 'question-asset')),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'archived', 'deleted')),
  owner_player_id uuid references public.players(id) on delete restrict,
  created_by_player_id uuid not null references public.players(id) on delete restrict,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  check ((kind = 'avatar' and bucket_id = 'avatars' and owner_player_id is not null
    and object_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
    or (kind = 'question-asset' and bucket_id = 'question-assets'
      and object_path like 'question-assets/%')),
  check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  check (byte_size is null or byte_size > 0),
  check (width is null or width > 0),
  check (height is null or height > 0),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  check (status <> 'ready' or (mime_type is not null and byte_size is not null
    and width is not null and height is not null and sha256 is not null)),
  check ((status = 'archived') = (archived_at is not null)),
  check ((status = 'deleted') = (deleted_at is not null))
);

create index media_assets_owner_status_idx
  on private.media_assets(owner_player_id, status, updated_at desc);
create index media_assets_bucket_path_idx
  on private.media_assets(bucket_id, object_path);

create trigger media_assets_touch_updated_at
before update on private.media_assets
for each row execute function private.touch_updated_at();
