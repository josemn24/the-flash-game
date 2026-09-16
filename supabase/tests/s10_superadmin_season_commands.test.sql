-- S10 private-season command boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('s10-season:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id, email)
values
  (pg_temp.test_id('auth-superadmin'), 's10-superadmin@example.com'),
  (pg_temp.test_id('auth-owner'), 's10-owner@example.com'),
  (pg_temp.test_id('auth-admin'), 's10-admin@example.com'),
  (pg_temp.test_id('auth-member'), 's10-member@example.com'),
  (pg_temp.test_id('auth-spectator'), 's10-spectator@example.com'),
  (pg_temp.test_id('auth-outsider'), 's10-outsider@example.com');
insert into public.players (id, auth_user_id, display_name)
values
  (pg_temp.test_id('superadmin'), pg_temp.test_id('auth-superadmin'), 'S10 operator'),
  (pg_temp.test_id('owner'), pg_temp.test_id('auth-owner'), 'S10 owner'),
  (pg_temp.test_id('admin'), pg_temp.test_id('auth-admin'), 'S10 admin'),
  (pg_temp.test_id('member'), pg_temp.test_id('auth-member'), 'S10 member'),
  (pg_temp.test_id('spectator'), pg_temp.test_id('auth-spectator'), 'S10 spectator'),
  (pg_temp.test_id('outsider'), pg_temp.test_id('auth-outsider'), 'S10 outsider');
insert into private.platform_role_assignments (player_id, role)
values (pg_temp.test_id('superadmin'), 'superadmin');
insert into public.rooms (id, slug, title, description, time_zone, status, deleted_at)
values
  (pg_temp.test_id('room-a'), 's10-room-a', 'S10 Room A', '', 'Europe/Madrid', 'active', null),
  (pg_temp.test_id('room-b'), 's10-room-b', 'S10 Room B', '', 'UTC', 'active', null),
  (pg_temp.test_id('room-deleted'), 's10-room-deleted', 'S10 Deleted', '', 'Europe/Madrid', 'deleted', now());
insert into public.room_memberships (room_id, player_id, role)
values
  (pg_temp.test_id('room-a'), pg_temp.test_id('owner'), 'owner'),
  (pg_temp.test_id('room-a'), pg_temp.test_id('admin'), 'admin'),
  (pg_temp.test_id('room-a'), pg_temp.test_id('member'), 'member'),
  (pg_temp.test_id('room-a'), pg_temp.test_id('spectator'), 'spectator'),
  (pg_temp.test_id('room-b'), pg_temp.test_id('owner'), 'owner');
insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values
  (pg_temp.test_id('legacy'), pg_temp.test_id('room-a'), 'Legacy season', 'finished', now() - interval '20 days', now() - interval '10 days'),
  (pg_temp.test_id('existing-active'), pg_temp.test_id('room-b'), 'Existing active', 'active', now() - interval '1 day', now() + interval '10 days');
set constraints all immediate;
set constraints all deferred;

select ok(has_function_privilege('authenticated', 'public.create_superadmin_season(jsonb)', 'EXECUTE'),
  'Authenticated can create seasons through the portal boundary');
select ok(has_function_privilege('authenticated', 'public.update_superadmin_season(jsonb)', 'EXECUTE'),
  'Authenticated can update seasons through the portal boundary');
select ok(has_function_privilege('authenticated', 'public.activate_superadmin_season(jsonb)', 'EXECUTE'),
  'Authenticated can activate seasons through the portal boundary');
select ok(not has_function_privilege('anon', 'public.create_superadmin_season(jsonb)', 'EXECUTE'),
  'Anonymous users cannot create seasons');
select ok(not has_function_privilege('service_role', 'public.activate_superadmin_season(jsonb)', 'EXECUTE'),
  'service_role cannot use the application season boundary');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid = 'public.activate_superadmin_season(jsonb)'::regprocedure), 'postgres',
  'Season activation is owned by postgres');
select ok((select proconfig @> array['search_path=""'] from pg_proc
  where oid = 'public.activate_superadmin_season(jsonb)'::regprocedure),
  'Season activation clears search_path');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-invalid-shape', 'roomId', pg_temp.test_id('room-a'), 'title', '',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'test'
))$$, '22023', 'invalid_season', 'Invalid title is rejected');
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-invalid-dates', 'roomId', pg_temp.test_id('room-a'), 'title', 'Invalid dates',
  'startsAt', now() + interval '2 days', 'endsAt', now() + interval '1 day', 'reason', 'test'
))$$, '22007', 'invalid_season_dates', 'Inverted dates are rejected');
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-deleted-room', 'roomId', pg_temp.test_id('room-deleted'), 'title', 'Deleted room',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'test'
))$$, '22023', 'room_not_found', 'Deleted rooms cannot receive seasons');

select is((public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-create-draft', 'roomId', pg_temp.test_id('room-a'), 'title', 'S10 draft',
  'startsAt', now() + interval '3 days', 'endsAt', now() + interval '10 days', 'reason', 'Prepare season'
))->>'status'), 'draft', 'A new season starts as draft');
reset role;
select is((select count(*) from public.seasons where room_id = pg_temp.test_id('room-a') and title = 'S10 draft'),
  1::bigint, 'Creating a draft persists exactly one season');
select is((select count(*) from private.audit_log where action = 'create_season'
  and entity_id = (select id from public.seasons where title = 'S10 draft')), 1::bigint,
  'Creating a draft writes one audit event');
select is((select reason from private.audit_log where action = 'create_season'
  and entity_id = (select id from public.seasons where title = 'S10 draft')), 'Prepare season',
  'Creating a draft audits its reason');
select is((select before_payload from private.audit_log where action = 'create_season'
  and entity_id = (select id from public.seasons where title = 'S10 draft')), null::jsonb,
  'Creating a draft audits an empty previous state');
select is((select after_payload->>'status' from private.audit_log where action = 'create_season'
  and entity_id = (select id from public.seasons where title = 'S10 draft')), 'draft',
  'Creating a draft audits its resulting state');
select set_config('s10.draft_id', (select id::text from public.seasons where title = 'S10 draft'), true);
set local role authenticated;

select is((public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-create-draft', 'roomId', pg_temp.test_id('room-a'), 'title', 'S10 draft',
  'startsAt', now() + interval '3 days', 'endsAt', now() + interval '10 days', 'reason', 'Prepare season'
))->>'status'), 'draft', 'An identical retry returns the original result');
reset role;
select is((select count(*) from public.seasons where title = 'S10 draft'), 1::bigint,
  'An idempotent retry does not duplicate the season');
select is((select count(*) from private.audit_log where action = 'create_season'
  and entity_id = (select id from public.seasons where title = 'S10 draft')), 1::bigint,
  'An idempotent retry does not duplicate the audit event');
set local role authenticated;
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-create-draft', 'roomId', pg_temp.test_id('room-a'), 'title', 'Changed input',
  'startsAt', now() + interval '3 days', 'endsAt', now() + interval '10 days', 'reason', 'Prepare season'
))$$, '40001', 'idempotency_conflict', 'A reused key with different data is rejected');

select is((public.update_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-update-draft', 'seasonId', current_setting('s10.draft_id')::uuid,
  'title', 'S10 edited', 'startsAt', now() + interval '4 days', 'endsAt', now() + interval '11 days',
  'reason', 'Adjust dates'
))->>'title'), 'S10 edited', 'A draft can be edited');
reset role;
select is((select before_payload->>'title' from private.audit_log where action = 'update_season'
  and entity_id = current_setting('s10.draft_id')::uuid), 'S10 draft',
  'Updating a draft audits its previous title');
select is((select after_payload->>'title' from private.audit_log where action = 'update_season'
  and entity_id = current_setting('s10.draft_id')::uuid), 'S10 edited',
  'Updating a draft audits its resulting title');
select is((select reason from private.audit_log where action = 'update_season'
  and entity_id = current_setting('s10.draft_id')::uuid), 'Adjust dates',
  'Updating a draft audits its reason');
set local role authenticated;
select throws_ok($$select public.update_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-update-active', 'seasonId', pg_temp.test_id('existing-active'),
  'title', 'Not allowed', 'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'test'
))$$, '55000', 'season_not_draft', 'An active season cannot be edited');
reset role;
select set_config('s10.edited_id', (select id::text from public.seasons where title = 'S10 edited'), true);
set local role authenticated;

select is((public.activate_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-activate-draft', 'seasonId', current_setting('s10.edited_id')::uuid,
  'reason', 'Open S10'
))->>'status'), 'active', 'A future-start season can be explicitly activated');
reset role;
select is((select before_payload->>'status' from private.audit_log where action = 'activate_season'
  and entity_id = current_setting('s10.edited_id')::uuid), 'draft',
  'Activation audits the draft as its previous state');
select is((select after_payload->>'status' from private.audit_log where action = 'activate_season'
  and entity_id = current_setting('s10.edited_id')::uuid), 'active',
  'Activation audits active as its resulting state');
select is((select reason from private.audit_log where action = 'activate_season'
  and entity_id = current_setting('s10.edited_id')::uuid), 'Open S10',
  'Activation audits its reason');
select is((select count(*) from public.scheduled_challenges where season_id =
  current_setting('s10.edited_id')::uuid), 0::bigint,
  'Activation does not create fictitious publications');
set local role authenticated;
select throws_ok($$select public.activate_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-activate-again', 'seasonId', current_setting('s10.edited_id')::uuid,
  'reason', 'Open again'
))$$, '55000', 'season_already_active', 'An active season cannot be activated again');

select is((public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-expired-create', 'roomId', pg_temp.test_id('room-a'), 'title', 'Expired draft',
  'startsAt', now() - interval '3 days', 'endsAt', now() - interval '1 day', 'reason', 'Test expiry'
))->>'status'), 'draft', 'An expired window can remain a draft');
reset role;
select set_config('s10.expired_id', (select id::text from public.seasons where title = 'Expired draft'), true);
set local role authenticated;
select throws_ok($$select public.activate_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-expired-activate', 'seasonId', current_setting('s10.expired_id')::uuid,
  'reason', 'Reject expiry'
))$$, '22007', 'invalid_season_dates', 'An expired season cannot be activated');

select is((public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-conflict-create', 'roomId', pg_temp.test_id('room-b'), 'title', 'Conflicting draft',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'Test conflict'
))->>'status'), 'draft', 'A second room can prepare a draft beside its active season');
reset role;
select set_config('s10.conflict_id', (select id::text from public.seasons where title = 'Conflicting draft'), true);
set local role authenticated;
select throws_ok($$select public.activate_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-conflict-activate', 'seasonId', current_setting('s10.conflict_id')::uuid,
  'reason', 'Reject conflict'
))$$, '23505', 'active_season_exists', 'Only one active season is allowed per room');

reset role;
select is((select status from public.seasons where id = pg_temp.test_id('legacy')), 'finished',
  'A previous terminal season is preserved');
select is((select count(*) from private.flash_point_entries where season_id =
  current_setting('s10.edited_id')::uuid), 0::bigint,
  'A new season starts with no Flash Point entries');
set local role authenticated;
select is((public.get_superadmin_portal_context()->'rooms'->0->>'timeZone'), 'Europe/Madrid',
  'Portal context exposes the room time zone');
select ok(exists (
  select 1 from jsonb_array_elements(public.get_superadmin_portal_context()->'rooms') room
  cross join lateral jsonb_array_elements(room->'seasons') season
  where season->>'title' = 'S10 edited' and season->>'status' = 'active'
), 'Portal context exposes the active season');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.seasons where room_id = pg_temp.test_id('room-a')), 2::bigint,
  'A member sees active seasons but not drafts through RLS');
select ok(not exists (
  select 1 from public.seasons where title = 'Expired draft'
), 'A member cannot see a draft season');
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-member-create', 'roomId', pg_temp.test_id('room-a'), 'title', 'Forbidden',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'Intrusion'
))$$, '42501', 'not_authorized', 'A normal member cannot create a season');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-owner'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-owner-create', 'roomId', pg_temp.test_id('room-a'), 'title', 'Forbidden',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'Intrusion'
))$$, '42501', 'not_authorized', 'An owner cannot create a season');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-admin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-admin-create', 'roomId', pg_temp.test_id('room-a'), 'title', 'Forbidden',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'Intrusion'
))$$, '42501', 'not_authorized', 'An admin cannot create a season');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-spectator'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select throws_ok($$select public.create_superadmin_season(jsonb_build_object(
  'idempotencyKey', 's10-spectator-create', 'roomId', pg_temp.test_id('room-a'), 'title', 'Forbidden',
  'startsAt', now() + interval '1 day', 'endsAt', now() + interval '2 days', 'reason', 'Intrusion'
))$$, '42501', 'not_authorized', 'A spectator cannot create a season');
reset role;

select ok(not has_function_privilege('anon', 'public.create_superadmin_season(jsonb)', 'EXECUTE'),
  'Anonymous users cannot invoke season commands');

select * from finish();
rollback;
