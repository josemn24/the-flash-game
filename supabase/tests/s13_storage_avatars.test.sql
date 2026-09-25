-- D08a/S13 avatar Storage registry and command boundary.
begin;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-5000-8000-000000000001', 'avatar-one@example.test'),
  ('00000000-0000-5000-8000-000000000002', 'avatar-two@example.test');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-5000-8000-000000000001', 'role', 'authenticated', 'is_anonymous', false,
  'user_metadata', jsonb_build_object('display_name', 'Avatar One')
)::text, true);
set local role authenticated;
select lives_ok($$select * from public.provision_player()$$, 'The first avatar owner is provisioned');
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-5000-8000-000000000002', 'role', 'authenticated', 'is_anonymous', false,
  'user_metadata', jsonb_build_object('display_name', 'Avatar Two')
)::text, true);
select lives_ok($$select * from public.provision_player()$$, 'The second avatar owner is provisioned');
reset role;
select set_config('s13.player_one', (select id::text from public.players where auth_user_id = '00000000-0000-5000-8000-000000000001'), true);
select set_config('s13.player_two', (select id::text from public.players where auth_user_id = '00000000-0000-5000-8000-000000000002'), true);

set local role authenticated;
select throws_ok(
  $$insert into private.media_assets(id, bucket_id, object_path, kind, owner_player_id, created_by_player_id)
    values ('00000000-0000-5000-8000-000000000101', 'avatars', 'avatars/other/file.png', 'avatar',
      private.current_player_id(), private.current_player_id())$$,
  '42501', null, 'Authenticated clients cannot insert media registry rows'
);
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-5000-8000-000000000001', 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role service_role;
select is(
  (private.prepare_avatar_upload_command(jsonb_build_object(
    'idempotencyKey', 'avatar-prepare-one',
    'assetId', '00000000-0000-5000-8000-000000000101',
    'objectPath', 'avatars/' || current_setting('s13.player_one') || '/00000000-0000-5000-8000-000000000101.png',
    'mimeType', 'image/png', 'byteSize', 128
  ))->>'status'), 'pending', 'Preparation creates a pending asset under the current player path'
);
select is(
  (private.prepare_avatar_upload_command(jsonb_build_object(
    'idempotencyKey', 'avatar-prepare-one',
    'assetId', '00000000-0000-5000-8000-000000000101',
    'objectPath', 'avatars/' || current_setting('s13.player_one') || '/00000000-0000-5000-8000-000000000101.png',
    'mimeType', 'image/png', 'byteSize', 128
  ))->>'status'), 'pending', 'Preparation is idempotent'
);
select throws_ok($$select private.prepare_avatar_upload_command(jsonb_build_object(
  'idempotencyKey', 'avatar-invalid-path', 'assetId', '00000000-0000-5000-8000-000000000102',
  'objectPath', 'avatars/' || current_setting('s13.player_two') || '/00000000-0000-5000-8000-000000000102.png',
  'mimeType', 'image/png', 'byteSize', 128))$$,
  '22023', 'invalid_avatar_path', 'A player cannot prepare another player path'
);
select is(
  (private.confirm_avatar_upload_command(jsonb_build_object(
    'idempotencyKey', 'avatar-confirm-one', 'assetId', '00000000-0000-5000-8000-000000000101',
    'mimeType', 'image/png', 'byteSize', 128, 'width', 64, 'height', 64,
    'sha256', repeat('a', 64)
  ))->'profile'->>'avatarPath'),
  'avatars/' || current_setting('s13.player_one') || '/00000000-0000-5000-8000-000000000101.png',
  'Confirmation marks the asset ready and updates the stable player path'
);
select is(
  (private.confirm_avatar_upload_command(jsonb_build_object(
    'idempotencyKey', 'avatar-confirm-one', 'assetId', '00000000-0000-5000-8000-000000000101',
    'mimeType', 'image/png', 'byteSize', 128, 'width', 64, 'height', 64,
    'sha256', repeat('a', 64)
  ))->>'assetId'),
  '00000000-0000-5000-8000-000000000101',
  'Confirmation is idempotent'
);
reset role;

select is((select avatar_path from public.players where auth_user_id = '00000000-0000-5000-8000-000000000001'),
  'avatars/' || current_setting('s13.player_one') || '/00000000-0000-5000-8000-000000000101.png',
  'The database stores a stable object path, never a signed URL');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '00000000-0000-5000-8000-000000000001', 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role service_role;
select lives_ok($$select private.prepare_avatar_upload_command(jsonb_build_object(
  'idempotencyKey', 'avatar-prepare-two', 'assetId', '00000000-0000-5000-8000-000000000102',
  'objectPath', 'avatars/' || current_setting('s13.player_one') || '/00000000-0000-5000-8000-000000000102.webp',
  'mimeType', 'image/webp', 'byteSize', 256))$$, 'A replacement can be prepared');
select lives_ok($$select private.confirm_avatar_upload_command(jsonb_build_object(
  'idempotencyKey', 'avatar-confirm-two', 'assetId', '00000000-0000-5000-8000-000000000102',
  'mimeType', 'image/webp', 'byteSize', 256, 'width', 128, 'height', 128,
  'sha256', repeat('b', 64)))$$, 'A replacement can be confirmed');
reset role;
select is((select status from private.media_assets where id = '00000000-0000-5000-8000-000000000101'),
  'archived', 'The previous avatar is archived after replacement');
select is((select status from private.media_assets where id = '00000000-0000-5000-8000-000000000102'),
  'ready', 'The replacement is ready');

select * from finish();
rollback;
