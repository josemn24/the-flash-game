import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Run in an empty, disposable database: the former content migration only ran
// when this exact published Cumbre v1 already existed before the upgrade.
const firstPartialMigration = "20261110183000_pyramid_connect_pairs_timeout_credit.sql";
const cumbreV1 = "dc880007-4a51-7fad-d259-6029d2c11ae6";
const preservedTables = [
  "public.players",
  "public.rooms",
  "public.room_memberships",
  "public.seasons",
  "private.challenge_definitions",
  "private.challenge_versions",
  "private.challenge_items",
  "private.question_versions",
  "private.question_version_solutions",
  "public.scheduled_challenges",
  "public.attempts",
  "private.attempt_answers",
  "private.flash_point_entries",
];

export async function testPyramidMigrationUpgrade(sql, migrations) {
  const firstPartialIndex = migrations.findIndex(({ name }) => name === firstPartialMigration);
  assert.ok(firstPartialIndex > 0, "The partial-credit upgrade must follow the existing schema");
  const apply = (batch) => sql(`begin;\n${batch.map(({ source }) => source).join("\n")}\ncommit;`);
  const json = async (source) => JSON.parse((await sql(source)).trim());
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        preservedTables.map(async (table) => [
          table,
          await json(
            `select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text), '[]') from ${table} row;`,
          ),
        ]),
      ),
    );
  await apply(migrations.slice(0, firstPartialIndex));
  await sql(`begin;
    ${await readFile("supabase/tests/support/command-fixtures.sql", "utf8")}
    create table test_support.pyramid_upgrade_sources(label text primary key, version_id uuid);
    insert into test_support.pyramid_upgrade_sources values
      ('cumbre', '${cumbreV1}'), ('biblia', test_support.id('migration-biblia-v1'));
    insert into private.challenge_definitions(id, slug, created_by_player_id)
      select test_support.id('migration-' || label), 'migration-' || label, test_support.id('superadmin')
      from test_support.pyramid_upgrade_sources;
    insert into private.challenge_versions(
      id, challenge_definition_id, version_number, mode, title, subtitle, description,
      max_score, mode_config, created_by_player_id
    ) select source.version_id, test_support.id('migration-' || source.label), 1, 'pyramid',
      case source.label when 'cumbre' then 'Cumbre lógica' else 'La Biblia' end,
      original.subtitle, original.description, original.max_score, '{}', original.created_by_player_id
      from test_support.pyramid_upgrade_sources source
      cross join private.challenge_versions original where original.id = test_support.id('cv-pyramid');
    insert into private.challenge_items(
      id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config
    ) select test_support.id('migration-' || source.label || '-item-' || item.position),
      source.version_id, item.question_version_id, item.position, item.points,
      item.config_schema_version, item.mode_config
      from test_support.pyramid_upgrade_sources source
      cross join private.challenge_items item where item.challenge_version_id = test_support.id('cv-pyramid');
    update private.challenge_versions set status = 'published'
      where id in (select version_id from test_support.pyramid_upgrade_sources);
    insert into public.rooms(id, slug, title)
      select test_support.id('migration-room-' || label), 'migration-' || label, label
      from test_support.pyramid_upgrade_sources;
    insert into public.room_memberships(room_id, player_id, role)
      select test_support.id('migration-room-' || label), test_support.id(actor),
        case actor when 'owner' then 'owner' else 'member' end
      from test_support.pyramid_upgrade_sources cross join unnest(array['owner','member']) actor;
    insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
      select test_support.id('migration-season-' || label), test_support.id('migration-room-' || label),
        label, 'active', now() - interval '2 days', now() + interval '2 days'
      from test_support.pyramid_upgrade_sources;
    insert into public.scheduled_challenges(
      id, season_id, challenge_version_id, number, status, opens_at, closes_at
    ) select test_support.id('migration-publication-' || label), test_support.id('migration-season-' || label),
      version_id, 1, 'open', now() - interval '1 day', now() + interval '1 day'
      from test_support.pyramid_upgrade_sources;
    commit;`);

  for (const label of ["cumbre", "biblia"]) {
    await sql(`begin;
      select test_support.as_actor('owner'); set local role service_role;
      select test_support.run('start_attempt', jsonb_build_object(
        'scheduledChallengeId', test_support.id('migration-publication-${label}'),
        'sessionToken', gen_random_uuid()::text || gen_random_uuid()::text));
      select test_support.run('prepare_interaction');
      select test_support.run('activate_interaction');
      select test_support.run('receive_answer', '{"answer":"A"}');
      select test_support.run('record_evaluation', '{"status":"correct","points":14}');
      select test_support.run('prepare_interaction');
      select test_support.run('activate_interaction');
      select test_support.run('receive_answer', '{"answer":"B"}');
      select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
      select test_support.run('complete_attempt');
      select test_support.as_actor('member');
      select test_support.run('start_attempt', jsonb_build_object(
        'scheduledChallengeId', test_support.id('migration-publication-${label}'),
        'sessionToken', gen_random_uuid()::text || gen_random_uuid()::text));
      select test_support.run('prepare_interaction');
      select test_support.run('activate_interaction');
      commit;`);
  }

  const before = await snapshot();
  assert.equal(before["public.attempts"].length, 4);
  assert.equal(before["private.flash_point_entries"].length, 2);
  assert.ok(before["private.flash_point_entries"].every(({ amount }) => amount > 0));
  await apply(migrations.slice(firstPartialIndex));
  const after = await snapshot();
  for (const table of preservedTables) {
    assert.deepEqual(after[table], before[table], `The upgrade must preserve ${table}`);
  }

  // Exercise the same authenticated command as «Crear corrección» in the portal.
  for (const label of ["cumbre", "biblia"]) {
    const revision = await json(`begin;
      select test_support.as_actor('superadmin'); set local role authenticated;
      select public.create_superadmin_challenge_revision(jsonb_build_object(
        'idempotencyKey', 'migration-create-${label}-v2',
        'sourceChallengeVersionId', ${label === "cumbre" ? `'${cumbreV1}'::uuid` : "test_support.id('migration-biblia-v1')"},
        'reason', 'Activar los parciales desde el portal'));
      commit;`);
    assert.equal(revision.versionNumber, 2, `${label} must leave v2 available to the portal`);
    assert.equal(revision.status, "draft");
    assert.equal(revision.questionCount, 7);
  }
  const final = await snapshot();
  for (const table of [
    "public.scheduled_challenges",
    "public.attempts",
    "private.attempt_answers",
    "private.flash_point_entries",
  ]) {
    assert.deepEqual(final[table], before[table], `Preparing v2 must preserve ${table}`);
  }
}
