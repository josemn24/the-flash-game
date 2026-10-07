begin;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id, email) values
  ('00000000-0000-5000-8000-000000000001', 'avatar-one@example.test'),
  ('00000000-0000-5000-8000-000000000002', 'avatar-two@example.test');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-5000-8000-000000000001","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select * from public.provision_player()$$, 'Provision owner');
reset role;
select set_config('avatar.owner', (select id::text from public.players where auth_user_id='00000000-0000-5000-8000-000000000001'), true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-5000-8000-000000000002","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select * from public.provision_player()$$, 'Provision other owner');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-5000-8000-000000000001","is_anonymous":false}', true);
create function pg_temp.prepare_avatar(n integer) returns jsonb language sql as $$
  select private.prepare_avatar_upload_command(jsonb_build_object(
    'assetId', '00000000-0000-5000-8000-' || lpad(n::text,12,'0'),
    'objectPath', 'avatars/' || current_setting('avatar.owner') || '/00000000-0000-5000-8000-' || lpad(n::text,12,'0') || '.png',
    'idempotencyKey', 'avatar-prepare-' || n, 'mimeType','image/png','byteSize',128));
$$;
create function pg_temp.confirm_avatar(n integer) returns jsonb language sql as $$
  select private.confirm_avatar_upload_command(jsonb_build_object(
    'assetId', '00000000-0000-5000-8000-' || lpad(n::text,12,'0'),
    'idempotencyKey','avatar-confirm-' || n,'mimeType','image/png','byteSize',128,'width',64,'height',64,'sha256',repeat('a',64)));
$$;
grant execute on function pg_temp.prepare_avatar(integer), pg_temp.confirm_avatar(integer) to service_role;
set local role service_role;
select is((private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}')->>'assetId'),null,'Absent confirmation is not fabricated');
select pg_temp.prepare_avatar(101);
select pg_temp.confirm_avatar(101);
select is((private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}')->'command'->>'assetId'), '00000000-0000-5000-8000-000000000101','Recover committed confirmation');
select is(pg_temp.prepare_avatar(101)->>'status','ready','Preparation replay reports current state');
select throws_ok($$select private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000102","idempotencyKey":"avatar-confirm-101"}')$$,'40001','idempotency_conflict','Same key and different image conflicts');
select throws_ok($$select private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-prepare-101"}')$$,'40001','idempotency_conflict','A preparation key cannot recover a confirmation');
select throws_ok($$select private.confirm_avatar_upload_command(jsonb_build_object('assetId','00000000-0000-5000-8000-000000000101','idempotencyKey','avatar-confirm-101','mimeType','image/png','byteSize',128,'width',64,'height',64,'sha256',repeat('b',64)))$$,'40001','idempotency_conflict','Different inspected content conflicts without writes');
select throws_ok($$select private.abort_avatar_upload_command('{"assetId":"00000000-0000-5000-8000-000000000101"}')$$,'55000','media_asset_in_use','Cancel cannot claim a referenced ready object');
select is(private.claim_archived_avatar_cleanup(jsonb_build_object('objectPath','avatars/'||current_setting('avatar.owner')||'/00000000-0000-5000-8000-000000000101.png')),null,'Cleanup cannot claim a ready object');
select pg_temp.prepare_avatar(102);
select pg_temp.confirm_avatar(102);
select is((private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}')->'currentProfile'->>'avatarPath'), 'avatars/'||current_setting('avatar.owner')||'/00000000-0000-5000-8000-000000000102.png','Old confirmation returns the current avatar');
select is(private.abort_avatar_upload_command('{"assetId":"00000000-0000-5000-8000-000000000101"}')->>'status','archived','Cancel cannot authorize removal of an archived object');
select is(private.claim_archived_avatar_cleanup(jsonb_build_object('objectPath','avatars/'||current_setting('avatar.owner')||'/00000000-0000-5000-8000-000000000101.png'))->>'status','deleted','Archived cleanup commits a tombstone');
select is(private.claim_archived_avatar_cleanup(jsonb_build_object('objectPath','avatars/'||current_setting('avatar.owner')||'/00000000-0000-5000-8000-000000000101.png'))->>'status','deleted','Cleanup claim can be repeated after Storage fails');
select is((private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}')->'command'->>'assetId'), '00000000-0000-5000-8000-000000000101','Historical confirmation survives old object deletion');
select pg_temp.prepare_avatar(103);
select is(private.abort_avatar_upload_command('{"assetId":"00000000-0000-5000-8000-000000000103"}')->>'status','deleted','Pending cancel commits a tombstone');
select is(private.abort_avatar_upload_command('{"assetId":"00000000-0000-5000-8000-000000000103"}')->>'status','deleted','Pending cancel can repeat physical removal');
select throws_ok($$select pg_temp.confirm_avatar(103)$$,'55000','media_asset_not_pending','Deleted upload cannot be resurrected');
select is(private.claim_archived_avatar_cleanup('{"objectPath":"avatars/legacy/unknown.png"}'),null,'Unregistered legacy object cannot be claimed');
reset role;
select is((select count(*)::int from private.audit_log where action='confirm_avatar_upload'),2,'Recovery and conflicts add no confirmation audit');
select ok((select archived_at is null and deleted_at is not null from private.media_assets where id='00000000-0000-5000-8000-000000000101'),'Archived to deleted timestamps are coherent');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-5000-8000-000000000002","is_anonymous":false}', true);
set local role service_role;
select is(private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}'),null,'Other account cannot recover the command');
select is(private.claim_archived_avatar_cleanup(jsonb_build_object('objectPath','avatars/'||current_setting('avatar.owner')||'/00000000-0000-5000-8000-000000000101.png')),null,'Other owner cannot claim deletion');
select throws_ok($$select private.abort_avatar_upload_command('{"assetId":"00000000-0000-5000-8000-000000000103"}')$$,'22023','media_asset_not_found','Other owner cannot cancel');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-5000-8000-000000000001","is_anonymous":false}', true);
update public.players set status='anonymized' where id=current_setting('avatar.owner')::uuid;
set local role service_role;
select throws_ok($$select private.read_avatar_upload_confirmation('{"assetId":"00000000-0000-5000-8000-000000000101","idempotencyKey":"avatar-confirm-101"}')$$,'42501','not_authorized','Inactive account cannot recover cached results');
reset role;
set local role authenticated;
select throws_ok($$select private.read_avatar_upload_confirmation('{}')$$,'42501',null,'Recovery is server-only');
select throws_ok($$select private.claim_archived_avatar_cleanup('{}')$$,'42501',null,'Cleanup is server-only');
reset role;
select * from finish();
rollback;
