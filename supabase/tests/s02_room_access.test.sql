-- S02 room projections: authorization, safe metadata and absence semantics.
-- This is a disposable pgTAP fixture, not application seed data.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('s02-room-access:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to anon, authenticated, service_role;

insert into auth.users (id)
select pg_temp.test_id('auth-' || name)
from unnest(array['alice', 'bob', 'spectator']) name;
insert into public.players (id, auth_user_id, display_name)
select pg_temp.test_id(name), pg_temp.test_id('auth-' || name), initcap(name)
from unnest(array['alice', 'bob', 'spectator']) name;
insert into public.rooms (id, slug, title, description) values
  (pg_temp.test_id('room-main'), 's02-main', 'Sala principal', 'Sala de pruebas S02'),
  (pg_temp.test_id('room-no-season'), 's02-no-season', 'Sala sin temporada', ''),
  (pg_temp.test_id('room-left'), 's02-left', 'Sala abandonada', ''),
  (pg_temp.test_id('room-other'), 's02-other', 'Sala externa', '');
insert into public.room_memberships (room_id, player_id, role)
values
  (pg_temp.test_id('room-main'), pg_temp.test_id('alice'), 'owner'),
  (pg_temp.test_id('room-main'), pg_temp.test_id('bob'), 'admin'),
  (pg_temp.test_id('room-main'), pg_temp.test_id('spectator'), 'spectator'),
  (pg_temp.test_id('room-no-season'), pg_temp.test_id('bob'), 'owner'),
  (pg_temp.test_id('room-no-season'), pg_temp.test_id('alice'), 'member'),
  (pg_temp.test_id('room-left'), pg_temp.test_id('bob'), 'owner'),
  (pg_temp.test_id('room-other'), pg_temp.test_id('bob'), 'owner');
insert into public.room_memberships
  (room_id, player_id, role, status, joined_at, ended_at)
values (
  pg_temp.test_id('room-left'), pg_temp.test_id('alice'), 'member', 'left',
  now() - interval '2 days', now() - interval '1 day'
);
set constraints all immediate;

insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values
  (pg_temp.test_id('season-main'), pg_temp.test_id('room-main'), 'Temporada S02', 'active',
    now() - interval '1 day', now() + interval '1 day'),
  (pg_temp.test_id('season-other'), pg_temp.test_id('room-other'), 'Temporada externa', 'active',
    now() - interval '1 day', now() + interval '1 day');

insert into private.question_definitions (id, slug, created_by_player_id)
values
  (pg_temp.test_id('question-one'), 's02-question-one', pg_temp.test_id('alice')),
  (pg_temp.test_id('question-two'), 's02-question-two', pg_temp.test_id('alice'));
insert into private.question_versions
  (id, question_definition_id, version_number, type, time_limit_ms, public_payload, created_by_player_id)
values
  (pg_temp.test_id('question-version-one'), pg_temp.test_id('question-one'), 1, 'short-text', 60000,
    '{"prompt":"S02_PRIVATE_PROMPT_ONE"}', pg_temp.test_id('alice')),
  (pg_temp.test_id('question-version-two'), pg_temp.test_id('question-two'), 1, 'short-text', 60000,
    '{"prompt":"S02_PRIVATE_PROMPT_TWO"}', pg_temp.test_id('alice'));
insert into private.question_version_solutions (question_version_id, solution_payload)
values
  (pg_temp.test_id('question-version-one'), '{"answer":"S02_PRIVATE_SOLUTION_ONE"}'),
  (pg_temp.test_id('question-version-two'), '{"answer":"S02_PRIVATE_SOLUTION_TWO"}');
update private.question_versions set status = 'published';

insert into private.challenge_definitions (id, slug, created_by_player_id)
values (pg_temp.test_id('challenge'), 's02-private-challenge', pg_temp.test_id('alice'));
insert into private.challenge_versions
  (id, challenge_definition_id, version_number, mode, title, subtitle, created_by_player_id)
values (
  pg_temp.test_id('challenge-version'), pg_temp.test_id('challenge'), 1, 'flash',
  'Flash: Metadatos S02', 'Dos preguntas de prueba', pg_temp.test_id('alice')
);
insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points)
values
  (pg_temp.test_id('challenge-item-one'), pg_temp.test_id('challenge-version'),
    pg_temp.test_id('question-version-one'), 1, 50),
  (pg_temp.test_id('challenge-item-two'), pg_temp.test_id('challenge-version'),
    pg_temp.test_id('question-version-two'), 2, 50);
update private.challenge_versions set status = 'published';
insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values (
  pg_temp.test_id('publication'), pg_temp.test_id('season-main'),
  pg_temp.test_id('challenge-version'), 1, 'open', now() - interval '1 hour', now() + interval '1 day'
);

select ok(has_function_privilege('authenticated', 'public.get_my_room_cards()', 'EXECUTE'),
  'Authenticated can call the room-card projection');
select ok(not has_function_privilege('anon', 'public.get_my_room_cards()', 'EXECUTE'),
  'Anonymous users cannot call the room-card projection');
select ok(not has_function_privilege('service_role', 'public.get_room_detail(text)', 'EXECUTE'),
  'service_role is not an application read boundary');

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_room_cards()), 2::bigint,
  'Alice sees only active memberships in active rooms');
select is((select membership_role from public.get_room_detail('s02-main')), 'owner'::text,
  'Alice role is projected from the active membership');
select is((select count(*) from public.get_room_detail('s02-other')), 0::bigint,
  'Alice cannot detail another user room');
select is((select count(*) from public.get_room_detail('s02-missing')), 0::bigint,
  'Missing room has the same observable absence as an unauthorized room');
select is((select count(*) from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 1::bigint,
  'Alice can open the authorized introduction');
select is((select membership_role from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 'owner'::text,
  'Introduction includes the current role only');
select is((select challenge_max_score from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 100,
  'Introduction exposes the challenge maximum score');
select is((select question_count from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 2::bigint,
  'Introduction exposes a question count, not questions');
select is((select count(*) from public.get_my_room_cards()
  where room_slug = 's02-no-season' and publication_id is null), 1::bigint,
  'A room without an active season remains visible without a publication');
select ok(not exists (
  select 1 from public.get_room_introduction('s02-main', pg_temp.test_id('publication'))
  where challenge_title like '%S02_PRIVATE%' or challenge_subtitle like '%S02_PRIVATE%'
), 'Private payload markers are absent from the introduction projection');
select throws_ok('select public_payload from private.question_versions', '42501', null,
  'Authenticated cannot read question payloads directly');
select throws_ok('select solution_payload from private.question_version_solutions', '42501', null,
  'Authenticated cannot read solutions directly');
select is((select count(*) from public.attempts), 0::bigint,
  'Opening an introduction does not create attempts');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-spectator'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_room_cards()), 1::bigint,
  'Spectator sees the room metadata');
select is((select membership_role from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 'spectator'::text,
  'Spectator can read the safe introduction metadata');
select is((select count(*) from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 1::bigint,
  'Spectator introduction has no competitive write side effect');
select is((select count(*) from public.get_room_detail('s02-left')), 0::bigint,
  'Spectator cannot cross into a room without membership');
reset role;

select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-bob'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_room_cards()), 4::bigint,
  'Bob sees his active admin and owner memberships');
select is((select membership_role from public.get_room_detail('s02-other')), 'owner'::text,
  'Bob can detail his external room');
select is((select count(*) from public.get_room_introduction(
  's02-other', pg_temp.test_id('publication'))), 0::bigint,
  'A publication from another room cannot be paired with this room slug');
reset role;

update public.scheduled_challenges
set status = 'closed', results_locked_at = now()
where id = pg_temp.test_id('publication');
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', pg_temp.test_id('auth-alice'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from public.get_my_room_cards()
  where room_slug = 's02-main' and publication_id is null), 1::bigint,
  'A closed publication is represented as no current challenge');
select is((select count(*) from public.get_room_introduction(
  's02-main', pg_temp.test_id('publication'))), 0::bigint,
  'A closed publication cannot be opened as a current introduction');
reset role;
select * from finish();
rollback;
