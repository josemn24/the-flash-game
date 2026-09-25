-- S16 — BetaVIP competitive formats must pass the shared calendar admission gate.
begin;
set local search_path = public, extensions;
select no_plan();
-- @command-fixtures

insert into private.question_definitions(id, slug, created_by_player_id)
values
  (test_support.id('s16-odd-one-out-definition'), 's16-odd-one-out', test_support.id('superadmin')),
  (test_support.id('s16-connect-pairs-definition'), 's16-connect-pairs', test_support.id('superadmin'));

insert into private.question_versions(
  id, question_definition_id, version_number, payload_schema_version, status, type,
  time_limit_ms, public_payload, created_by_player_id)
values
  (
    test_support.id('s16-odd-one-out-version'),
    test_support.id('s16-odd-one-out-definition'),
    1, 1, 'draft', 'odd-one-out', 25000,
    jsonb_build_object(
      'question', '¿Qué número rompe el patrón?',
      'items', jsonb_build_array(
        jsonb_build_object('id', 'cube-8', 'label', '8'),
        jsonb_build_object('id', 'cube-27', 'label', '27'),
        jsonb_build_object('id', 'cube-81', 'label', '81')
      )
    ),
    test_support.id('superadmin')
  ),
  (
    test_support.id('s16-connect-pairs-version'),
    test_support.id('s16-connect-pairs-definition'),
    1, 1, 'draft', 'connect-pairs', 45000,
    jsonb_build_object(
      'question', 'Encuentra las rutas que completan el tablero.',
      'grid', jsonb_build_object('rows', 5, 'columns', 5),
      'pairs', jsonb_build_array(
        jsonb_build_object('id', 'circle', 'label', 'Círculo', 'symbol', '●', 'endpoints', jsonb_build_array(0, 9)),
        jsonb_build_object('id', 'triangle', 'label', 'Triángulo', 'symbol', '▲', 'endpoints', jsonb_build_array(14, 21)),
        jsonb_build_object('id', 'diamond', 'label', 'Rombo', 'symbol', '◆', 'endpoints', jsonb_build_array(20, 7))
      ),
      'requireFullCoverage', true
    ),
    test_support.id('superadmin')
  );

insert into private.question_version_solutions(question_version_id, solution_payload)
values
  (
    test_support.id('s16-odd-one-out-version'),
    jsonb_build_object('correctAnswer', 'cube-81', 'explanation', '81 no es un cubo perfecto.')
  ),
  (
    test_support.id('s16-connect-pairs-version'),
    jsonb_build_object(
      'paths', jsonb_build_object(
        'circle', jsonb_build_array(0, 1, 2, 3, 4, 9),
        'triangle', jsonb_build_array(14, 19, 24, 23, 22, 21),
        'diamond', jsonb_build_array(20, 15, 10, 5, 6, 7)
      ),
      'explanation', 'Las rutas cubren sus parejas.'
    )
  );

update private.question_versions
set status = 'published', published_at = now()
where id in (
  test_support.id('s16-odd-one-out-version'),
  test_support.id('s16-connect-pairs-version')
);

insert into private.challenge_definitions(id, slug, created_by_player_id)
values (test_support.id('s16-challenge-definition'), 's16-supported-formats', test_support.id('superadmin'));

insert into private.challenge_versions(
  id, challenge_definition_id, version_number, config_schema_version, status, mode,
  title, subtitle, description, max_score, mode_config, created_by_player_id)
values (
  test_support.id('s16-challenge-version'), test_support.id('s16-challenge-definition'), 1, 1,
  'draft', 'flash', 'S16 formatos competitivos', 'BetaVIP', 'Regresión de admisión.',
  100, '{}'::jsonb, test_support.id('superadmin')
);

insert into private.challenge_items(
  id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
values
  (test_support.id('s16-item-odd-one-out'), test_support.id('s16-challenge-version'),
    test_support.id('s16-odd-one-out-version'), 1, 50, 1, '{}'::jsonb),
  (test_support.id('s16-item-connect-pairs'), test_support.id('s16-challenge-version'),
    test_support.id('s16-connect-pairs-version'), 2, 50, 1, '{}'::jsonb);

update private.challenge_versions
set status = 'published', published_at = now()
where id = test_support.id('s16-challenge-version');

select ok(private.is_supported_flash_question(test_support.id('s16-odd-one-out-version')),
  'Odd-one-out is admitted by the shared Flash predicate');
select ok(private.is_supported_flash_question(test_support.id('s16-connect-pairs-version')),
  'Connect-pairs is admitted by the shared Flash predicate');
select lives_ok($$select private.assert_supported_calendar_content(test_support.id('s16-challenge-version'))$$,
  'The calendar accepts the BetaVIP competitive formats');

select * from finish();
rollback;
