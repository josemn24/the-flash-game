-- S12 calendar boundary. Disposable fixture only.
begin;
set local search_path = public, extensions;
select no_plan();

-- @command-fixtures

select ok(has_function_privilege('authenticated', 'public.get_superadmin_calendar_context()', 'EXECUTE'),
  'Authenticated can read the protected calendar context');
select ok(has_function_privilege('authenticated', 'public.create_superadmin_scheduled_challenge(jsonb)', 'EXECUTE'),
  'Authenticated can create scheduled challenges through the portal boundary');
select ok(has_function_privilege('authenticated', 'public.update_superadmin_scheduled_challenge(jsonb)', 'EXECUTE'),
  'Authenticated can update scheduled challenges through the portal boundary');
select ok(has_function_privilege('service_role', 'private.run_calendar_tick_command(jsonb)', 'EXECUTE'),
  'Only the local service role can execute the calendar tick');
select ok(not has_function_privilege('anon', 'public.create_superadmin_scheduled_challenge(jsonb)', 'EXECUTE'),
  'Anonymous users cannot schedule challenges');
select ok(not has_function_privilege('service_role', 'public.create_superadmin_scheduled_challenge(jsonb)', 'EXECUTE'),
  'service_role cannot use the application scheduling boundary');
select ok(not has_function_privilege('authenticated', 'private.run_calendar_tick_command(jsonb)', 'EXECUTE'),
  'Authenticated clients cannot execute the internal tick');

insert into public.rooms(id, slug, title)
values (test_support.id('s12-room'), 's12-room', 'Sala S12');
insert into public.room_memberships(room_id, player_id, role)
values
  (test_support.id('s12-room'), test_support.id('member'), 'member'),
  (test_support.id('s12-room'), test_support.id('spectator'), 'spectator');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('s12-season'), test_support.id('s12-room'), 'Temporada S12', 'active', now() - interval '1 day', now() + interval '3 days');

insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('s12-cd'), 's12-flash-001', test_support.id('superadmin'));
insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id
)
values (
  test_support.id('s12-cv'), test_support.id('s12-cd'), 1, 1, 'draft', 'flash',
  'Flash S12', 'Calendario', 'Contenido de calendario', 100, '{}'::jsonb, test_support.id('superadmin')
);
insert into private.question_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s12-q1'), 's12-q1', test_support.id('superadmin')),
  (test_support.id('s12-q2'), 's12-q2', test_support.id('superadmin'));
insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id
)
values
  (test_support.id('s12-qv1'), test_support.id('s12-q1'), 1, 1, 'draft', 'multiple-choice', 15000,
    '{"question":"¿Uno?","options":["Uno","Dos"]}', test_support.id('superadmin')),
  (test_support.id('s12-qv2'), test_support.id('s12-q2'), 1, 1, 'draft', 'multiple-choice', 12000,
    '{"question":"¿Dos?","options":["Dos","Tres"]}', test_support.id('superadmin'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (test_support.id('s12-qv1'), '{"correctAnswer":"Uno"}'),
  (test_support.id('s12-qv2'), '{"correctAnswer":"Dos"}');
insert into private.challenge_items(challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('s12-cv'), test_support.id('s12-qv1'), 1, 50, 1, '{}'::jsonb),
  (test_support.id('s12-cv'), test_support.id('s12-qv2'), 2, 50, 1, '{}'::jsonb);
update private.question_versions set status = 'published' where id in (test_support.id('s12-qv1'), test_support.id('s12-qv2'));
update private.challenge_versions set status = 'published' where id = test_support.id('s12-cv');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-superadmin'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;

select throws_ok($$select public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-invalid-date', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 1,
  'opensAt', now() + interval '2 hours', 'closesAt', now() + interval '1 hour', 'reason', 'Invalid window'
))$$, '22007', 'invalid_schedule_dates', 'Inverted schedule dates are rejected');

select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-create-01', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 1,
  'opensAt', now() - interval '1 minute', 'closesAt', now() + interval '2 hours', 'reason', 'Abrir la primera ventana'
))->>'status'), 'scheduled', 'A publication starts as scheduled');
reset role;
select set_config('s12.schedule_id', (select id::text from public.scheduled_challenges where season_id = test_support.id('s12-season') and number = 1), true);
select is((select count(*) from public.scheduled_challenges where id = current_setting('s12.schedule_id')::uuid), 1::bigint,
  'Scheduling persists one publication');
select is((select count(*) from private.audit_log where action = 'create_scheduled_challenge' and entity_id = current_setting('s12.schedule_id')::uuid), 1::bigint,
  'Scheduling writes one audit event');
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-create-01', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 1,
  'opensAt', now() - interval '1 minute', 'closesAt', now() + interval '2 hours', 'reason', 'Abrir la primera ventana'
))->>'scheduledChallengeId'), current_setting('s12.schedule_id'), 'Identical scheduling retries return the original result');
select throws_ok($$select public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-create-01', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 2,
  'opensAt', now() + interval '1 day', 'closesAt', now() + interval '1 day 1 hour', 'reason', 'Reuse conflict'
))$$, '40001', 'idempotency_conflict', 'A reused key with different schedule data is rejected');

select set_config('s12.future_opens', (now() + interval '1 day')::text, true);
select set_config('s12.future_closes', (now() + interval '1 day 1 hour')::text, true);
set local role authenticated;
select is((public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-create-02', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 2,
  'opensAt', current_setting('s12.future_opens')::timestamptz,
  'closesAt', current_setting('s12.future_closes')::timestamptz, 'reason', 'Preparar la segunda ventana'
))->>'status'), 'scheduled', 'A future publication is visible before opening');
reset role;
select set_config('s12.future_id', (select id::text from public.scheduled_challenges where season_id = test_support.id('s12-season') and number = 2), true);
select set_config('s12.future_updated_at', (select updated_at::text from public.scheduled_challenges where id = current_setting('s12.future_id')::uuid), true);
select is((public.update_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-update-02', 'scheduledChallengeId', current_setting('s12.future_id')::uuid,
  'expectedUpdatedAt', current_setting('s12.future_updated_at')::timestamptz,
  'challengeVersionId', test_support.id('s12-cv'), 'number', 3,
  'opensAt', now() + interval '1 day 2 hours', 'closesAt', now() + interval '1 day 3 hours',
  'reason', 'Reprogramar la segunda ventana'
))->>'number'), '3', 'A future scheduled publication can be reprogrammed');
select throws_ok($$select public.update_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-stale-update', 'scheduledChallengeId', current_setting('s12.future_id')::uuid,
  'expectedUpdatedAt', current_setting('s12.future_updated_at')::timestamptz,
  'challengeVersionId', test_support.id('s12-cv'), 'number', 4,
  'opensAt', now() + interval '1 day 4 hours', 'closesAt', now() + interval '1 day 5 hours', 'reason', 'Stale'
))$$, '40001', 'schedule_conflict', 'A stale schedule update is rejected');

reset role;
set local role service_role;
select is((private.run_calendar_tick_command(jsonb_build_object('runId', 's12-tick-open-01'))->>'opened')::integer, 1,
  'The tick opens a schedule at its inclusive opening boundary');
select is((select status from public.scheduled_challenges where id = current_setting('s12.schedule_id')::uuid), 'open',
  'An eligible schedule becomes open');
select is((private.run_calendar_tick_command(jsonb_build_object('runId', 's12-tick-open-02'))->>'opened')::integer, 0,
  'A repeated tick is idempotent for already open schedules');
select is((select count(*) from private.audit_log where entity_id = current_setting('s12.schedule_id')::uuid and action = 'open_scheduled_challenge'), 1::bigint,
  'A repeated tick does not duplicate opening audit');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', test_support.id('auth-member'), 'role', 'authenticated', 'is_anonymous', false
)::text, true);
set local role authenticated;
select is((select count(*) from public.get_room_calendar('s12-room')), 2::bigint,
  'A member sees future and available calendar metadata');
select is((select availability_status from public.get_room_calendar('s12-room') where publication_number = 1), 'available',
  'Public availability is derived from the PostgreSQL clock');
select is((select can_continue from public.get_room_calendar('s12-room') where publication_number = 1), false,
  'A member without an attempt cannot continue and receives a boolean false');
select is((select count(*) from public.get_room_introduction('s12-room', current_setting('s12.schedule_id')::uuid)), 1::bigint,
  'A member can open the introduction for an available publication');
select ok(not exists (
  select 1 from jsonb_array_elements(coalesce((select jsonb_agg(to_jsonb(calendar)) from public.get_room_calendar('s12-room') calendar), '[]'::jsonb)) item
  where item ? 'solution'
), 'The public calendar contains no solutions');
select throws_ok($$select public.create_superadmin_scheduled_challenge(jsonb_build_object(
  'idempotencyKey', 's12-member-create', 'seasonId', test_support.id('s12-season'),
  'challengeVersionId', test_support.id('s12-cv'), 'number', 4,
  'opensAt', now() + interval '1 day', 'closesAt', now() + interval '1 day 1 hour', 'reason', 'Forbidden'
))$$, '42501', 'not_authorized', 'A member cannot schedule a challenge');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('role', 'anon', 'is_anonymous', true)::text, true);
set local role anon;
select throws_ok($$select public.get_room_calendar('s12-room')$$, '42501', 'permission denied for function get_room_calendar',
  'Anonymous users cannot read the calendar');
reset role;

-- A delayed tick reconciles a previously scheduled publication without touching results locks.
insert into public.rooms(id, slug, title)
values (test_support.id('s12-close-room'), 's12-close-room', 'Sala S12 cierre');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
values (test_support.id('s12-close-season'), test_support.id('s12-close-room'), 'Cierre S12', 'active', now() - interval '2 days', now() + interval '2 days');
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at, results_locked_at)
values (test_support.id('s12-close-schedule'), test_support.id('s12-close-season'), test_support.id('s12-cv'), 1, 'scheduled', now() - interval '2 hours', now() - interval '1 minute', now());
select set_config('s12.results_locked_at', (select results_locked_at::text from public.scheduled_challenges where id = test_support.id('s12-close-schedule')), true);
set local role service_role;
select is((private.run_calendar_tick_command(jsonb_build_object('runId', 's12-tick-close-01'))->>'closed')::integer, 1,
  'A delayed tick closes an expired scheduled publication');
select is((select status from public.scheduled_challenges where id = test_support.id('s12-close-schedule')), 'closed',
  'Expired schedules are closed rather than cancelled');
select is((select results_locked_at::text from public.scheduled_challenges where id = test_support.id('s12-close-schedule')), current_setting('s12.results_locked_at'),
  'The tick leaves results_locked_at unchanged');
select is((private.run_calendar_tick_command(jsonb_build_object('runId', 's12-tick-close-02'))->>'closed')::integer, 0,
  'A repeated close tick is idempotent');
reset role;

select * from finish();
rollback;
