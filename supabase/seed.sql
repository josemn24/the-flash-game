-- Dataset de dominio para pruebas manuales en navegador.
-- Este archivo se ejecuta mediante scripts/seed-browser.mjs después de crear Auth
-- y provisionar Player. Los player_id llegan como variables psql para no insertar
-- usuarios ni saltarse el flujo normal de provision_player.

begin;
set constraints all deferred;

insert into private.platform_role_assignments (player_id, role)
values (:'browser_superadmin_player_id'::uuid, 'superadmin');

insert into public.rooms (id, slug, title, description, time_zone, status)
values
  ('11111111-1111-4111-8111-111111111111', 'browser-playground',
    'Sala de pruebas', 'Sala persistida para probar la interfaz desde el navegador.',
    'Europe/Madrid', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'browser-isolated',
    'Sala aislada', 'Sala visible únicamente para el usuario externo.',
    'Europe/Madrid', 'active');

insert into public.room_memberships (room_id, player_id, role, status)
values
  ('11111111-1111-4111-8111-111111111111', :'browser_owner_player_id'::uuid, 'owner', 'active'),
  ('11111111-1111-4111-8111-111111111111', :'browser_admin_player_id'::uuid, 'admin', 'active'),
  ('11111111-1111-4111-8111-111111111111', :'browser_member_player_id'::uuid, 'member', 'active'),
  ('11111111-1111-4111-8111-111111111111', :'browser_spectator_player_id'::uuid, 'spectator', 'active'),
  ('22222222-2222-4222-8222-222222222222', :'browser_outsider_player_id'::uuid, 'owner', 'active');

insert into public.seasons (id, room_id, title, status, starts_at, ends_at)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Temporada de pruebas', 'active', now() - interval '1 day', now() + interval '30 days'
);

insert into private.question_definitions (id, slug, created_by_player_id)
values
  ('66666666-6666-4666-8666-666666666666', 'browser-capital-portugal', :'browser_superadmin_player_id'::uuid),
  ('77777777-7777-4777-8777-777777777777', 'browser-planeta-rojo', :'browser_superadmin_player_id'::uuid);

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values
  ('88888888-8888-4888-8888-888888888888', '66666666-6666-4666-8666-666666666666', 1, 1, 'draft',
    'multiple-choice', 15000,
    '{"category":"Cultura general","tags":{},"question":"¿Cuál es la capital de Portugal?","options":["Lisboa","Oporto","Braga","Coímbra"],"media":null,"promptVisual":null}'::jsonb,
    :'browser_superadmin_player_id'::uuid),
  ('99999999-9999-4999-8999-999999999999', '77777777-7777-4777-8777-777777777777', 1, 1, 'draft',
    'multiple-choice', 15000,
    '{"category":"Ciencia","tags":{},"question":"¿Qué planeta es conocido como el planeta rojo?","options":["Venus","Marte","Júpiter","Saturno"],"media":null,"promptVisual":null}'::jsonb,
    :'browser_superadmin_player_id'::uuid);

insert into private.question_version_solutions (question_version_id, solution_payload)
values
  ('88888888-8888-4888-8888-888888888888', '{"correctAnswer":"Lisboa","explanation":"Lisboa es la capital de Portugal."}'::jsonb),
  ('99999999-9999-4999-8999-999999999999', '{"correctAnswer":"Marte","explanation":"Marte es conocido como el planeta rojo."}'::jsonb);

insert into private.challenge_definitions (id, slug, created_by_player_id)
values ('44444444-4444-4444-8444-444444444444', 'browser-flash', :'browser_superadmin_player_id'::uuid);

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444', 1, 1, 'draft', 'flash',
  'Flash de pruebas', 'Dos preguntas de 50 puntos',
  'Desafío persistido para pruebas manuales.', 100, '{}'::jsonb,
  :'browser_superadmin_player_id'::uuid
);

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', '88888888-8888-4888-8888-888888888888', 1, 50, 1, '{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', '99999999-9999-4999-8999-999999999999', 2, 50, 1, '{}'::jsonb);

update private.question_versions
set status = 'published'
where id in ('88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999');

update private.challenge_versions
set status = 'published'
where id = '55555555-5555-4555-8555-555555555555';

insert into public.scheduled_challenges
  (id, season_id, challenge_version_id, number, status, opens_at, closes_at)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555', 1, 'open',
    now() - interval '1 hour', now() + interval '6 hours'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555', 2, 'scheduled',
    now() + interval '1 day', now() + interval '2 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555', 3, 'closed',
    now() - interval '7 days', now() - interval '6 days');

-- Draft editorial independiente para comprobar que el portal distingue borradores
-- de contenido publicado y no lo expone en las lecturas competitivas.
insert into private.question_definitions (id, slug, created_by_player_id)
values
  ('12345678-1234-4234-8234-123456789abc', 'browser-draft-one', :'browser_superadmin_player_id'::uuid),
  ('23456789-2345-4234-8234-23456789abcd', 'browser-draft-two', :'browser_superadmin_player_id'::uuid);

insert into private.question_versions
  (id, question_definition_id, version_number, payload_schema_version, status, type,
   time_limit_ms, public_payload, created_by_player_id)
values
  ('34567890-3456-4234-8234-34567890abcd', '12345678-1234-4234-8234-123456789abc', 1, 1, 'draft',
    'multiple-choice', 15000,
    '{"category":"Pruebas","tags":{},"question":"Pregunta de borrador uno","options":["A","B"],"media":null,"promptVisual":null}'::jsonb,
    :'browser_superadmin_player_id'::uuid),
  ('45678901-4567-4234-8234-45678901abcd', '23456789-2345-4234-8234-23456789abcd', 1, 1, 'draft',
    'multiple-choice', 15000,
    '{"category":"Pruebas","tags":{},"question":"Pregunta de borrador dos","options":["A","B"],"media":null,"promptVisual":null}'::jsonb,
    :'browser_superadmin_player_id'::uuid);

insert into private.question_version_solutions (question_version_id, solution_payload)
values
  ('34567890-3456-4234-8234-34567890abcd', '{"correctAnswer":"A","explanation":"Respuesta de prueba."}'::jsonb),
  ('45678901-4567-4234-8234-45678901abcd', '{"correctAnswer":"B","explanation":"Respuesta de prueba."}'::jsonb);

insert into private.challenge_definitions (id, slug, created_by_player_id)
values ('56789012-5678-4234-8234-56789012abcd', 'browser-draft', :'browser_superadmin_player_id'::uuid);

insert into private.challenge_versions
  (id, challenge_definition_id, version_number, config_schema_version, status, mode,
   title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  '67890123-6789-4234-8234-67890123abcd',
  '56789012-5678-4234-8234-56789012abcd', 1, 1, 'draft', 'flash',
  'Flash borrador local', 'Contenido editable',
  'Borrador para probar el portal editorial.', 100, '{}'::jsonb,
  :'browser_superadmin_player_id'::uuid
);

insert into private.challenge_items
  (id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  ('78901234-7890-4234-8234-78901234abcd', '67890123-6789-4234-8234-67890123abcd', '34567890-3456-4234-8234-34567890abcd', 1, 50, 1, '{}'::jsonb),
  ('89012345-8901-4234-8234-89012345abcd', '67890123-6789-4234-8234-67890123abcd', '45678901-4567-4234-8234-45678901abcd', 2, 50, 1, '{}'::jsonb);

commit;
