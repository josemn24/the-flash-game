-- Reuses the command harness and published Pyramid choice levels. Queens is level 2.
insert into private.question_definitions(id, slug, created_by_player_id)
values (test_support.id('pyramid-queens-q'), 'pyramid-queens', test_support.id('owner'));
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
  status, type, time_limit_ms, public_payload, created_by_player_id)
values (test_support.id('pyramid-queens-qv'), test_support.id('pyramid-queens-q'), 1, 1,
  'draft', 'queens', 60000,
  '{"question":"Coloca cinco coronas.","grid":{"rows":5,"columns":5},"regions":[0,0,0,1,1,2,0,1,1,1,2,2,1,3,1,2,3,3,3,3,2,4,3,3,3],"prefilledQueens":[2]}',
  test_support.id('owner'));
insert into private.question_version_solutions(question_version_id, solution_payload)
values (test_support.id('pyramid-queens-qv'), '{"solution":[2,9,10,18,21]}');
update private.question_versions set status = 'published', published_at = now()
where id = test_support.id('pyramid-queens-qv');
insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('pyramid-queens-cd'), 'pyramid-queens', test_support.id('owner'));
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version,
  status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
values (test_support.id('pyramid-queens-cv'), test_support.id('pyramid-queens-cd'), 1, 1,
  'draft', 'pyramid', 'Pirámide Queens', 'Tres intentos', 'Queens en el segundo nivel.', 100, '{}', test_support.id('owner'));
insert into private.challenge_items(id, challenge_version_id, question_version_id, position,
  points, config_schema_version, mode_config)
select test_support.id('pyramid-queens-item-' || position), test_support.id('pyramid-queens-cv'),
  case when position = 2 then test_support.id('pyramid-queens-qv') else question_version_id end,
  position, points, config_schema_version, mode_config
from private.challenge_items where challenge_version_id = test_support.id('cv-pyramid');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('pyramid-queens-cv');
-- A short published clock exercises timeout without rewriting immutable timing records.
insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
  status, type, time_limit_ms, public_payload, created_by_player_id)
select test_support.id('pyramid-queens-timeout-qv'), question_definition_id, 2, payload_schema_version,
  'draft', type, 1000, public_payload, created_by_player_id
from private.question_versions where id = test_support.id('pyramid-queens-qv');
insert into private.question_version_solutions(question_version_id, solution_payload)
select test_support.id('pyramid-queens-timeout-qv'), solution_payload
from private.question_version_solutions where question_version_id = test_support.id('pyramid-queens-qv');
update private.question_versions set status = 'published', published_at = now()
where id = test_support.id('pyramid-queens-timeout-qv');
insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version,
  status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
select test_support.id('pyramid-queens-timeout-cv'), challenge_definition_id, 2, config_schema_version,
  'draft', mode, title, subtitle, description, max_score, mode_config, created_by_player_id
from private.challenge_versions where id = test_support.id('pyramid-queens-cv');
insert into private.challenge_items(id, challenge_version_id, question_version_id, position,
  points, config_schema_version, mode_config)
select test_support.id('pyramid-queens-timeout-item-' || position), test_support.id('pyramid-queens-timeout-cv'),
  case when position = 2 then test_support.id('pyramid-queens-timeout-qv') else question_version_id end,
  position, points, config_schema_version, mode_config
from private.challenge_items where challenge_version_id = test_support.id('pyramid-queens-cv');
update private.challenge_versions set status = 'published', published_at = now()
where id = test_support.id('pyramid-queens-timeout-cv');
insert into public.rooms(id, slug, title)
select test_support.id('pyramid-queens-room-' || n), 'pyramid-queens-' || n, 'Pirámide Queens ' || n
from generate_series(2, 7) n;
insert into public.room_memberships(room_id, player_id, role)
select test_support.id('pyramid-queens-room-' || n), m.player_id, m.role
from public.room_memberships m cross join generate_series(2, 7) n
where m.room_id = test_support.id('room-pyramid');
insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
select test_support.id('pyramid-queens-season-' || n), test_support.id('pyramid-queens-room-' || n),
  'Queens ' || n, 'active', now() - interval '1 day', now() + interval '2 days'
from generate_series(2, 7) n;
insert into public.scheduled_challenges(id, season_id, challenge_version_id, number, status, opens_at, closes_at)
select test_support.id('pyramid-queens-sc-' || n), test_support.id('pyramid-queens-season-' || n),
  test_support.id(case when n = 6 then 'pyramid-queens-timeout-cv' else 'pyramid-queens-cv' end),
  n, 'open', now() - interval '1 hour', now() + interval '1 day'
from generate_series(2, 7) n;

create function test_support.start_pyramid_queens(publication_number integer default 2) returns jsonb
language plpgsql as $$
begin
  perform test_support.run('start_attempt', jsonb_build_object(
    'scheduledChallengeId', test_support.id('pyramid-queens-sc-' || publication_number),
    'sessionToken', repeat(chr(ascii('q') + publication_number - 2), 40)));
  perform test_support.run('prepare_interaction');
  perform test_support.run('activate_interaction');
  perform test_support.run('receive_answer', '{"answer":"A"}');
  perform test_support.run('record_evaluation', '{"status":"correct","points":14}');
  return test_support.run('prepare_interaction');
end;
$$;
grant execute on function test_support.start_pyramid_queens(integer) to service_role;
