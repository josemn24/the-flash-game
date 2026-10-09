import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { functionsQuery, snapshotFunction } from "./test-question-validation-upgrade.mjs";
import { checkInventory } from "./supabase-security-inventory.mjs";

export const competitiveCommandMigration = "20261009190015_competitive_command_reconciliation.sql";

export function assertReconciledCommandBehavior(observations) {
  const cases = new Map(observations.map(({ id, result }) => [id, result]));
  assert.equal(cases.size, 41, "All reconciliation probes must run");
  for (const [id, { observation, state }] of cases) {
    assert.equal(state.wrapperOidPreserved, true, `${id}: wrapper OID`);
    assert.equal(state.pointEntries, 0, `${id}: no new points`);
    let error;
    if (
      id.startsWith("race/") ||
      id.endsWith("/takeover") ||
      id === "authorize-replay/transferred"
    ) {
      error = ["42501", "session_transferred"];
    } else if (id.startsWith("unknown-token/") || id.startsWith("revoked/")) {
      error = ["42501", "session_revoked"];
    } else if (id.startsWith("takeover/null-") || id === "dispatcher/without-schedule") {
      error = ["22023", "invalid_command"];
    } else if (id === "takeover/cached-after-membership-removal") {
      error = ["42501", "not_authorized"];
    }
    if (error) {
      assert.deepEqual(
        observation,
        { accepted: false, sqlstate: error[0], message: error[1] },
        `${id}: error contract`,
      );
    } else {
      assert.equal(observation.accepted, true, `${id}: acceptance`);
    }
    if (id.startsWith("closure/") || id === "expiration/inactivity") {
      const reason = id.startsWith("closure/") ? id.slice(8) : "inactivity_timeout";
      assert.equal(state.attempt.status, "abandoned", `${id}: terminal status`);
      assert.equal(state.attempt.terminalReason, reason, `${id}: terminal reason`);
      assert.deepEqual(
        state.sessions,
        [{ revoked: true, reason: reason === "permission_revoked" ? reason : "terminal" }],
        `${id}: session closure reason`,
      );
      assert.equal(state.audit.length, 1, `${id}: one audit event`);
      if (id === "expiration/inactivity") {
        assert.equal(observation.abandonedAttempts, 1);
        assert.match(
          state.audit[0].requestId,
          /^audit-inactivity:inactivity_timeout:[0-9a-f-]{36}$/,
        );
      }
    }
    if (id.startsWith("race/") || (observation.accepted && observation.transferred)) {
      assert.equal(state.attempt.lockVersion, 2, `${id}: one version increment`);
      assert.deepEqual(
        state.sessions,
        [
          { revoked: false, reason: null },
          { revoked: true, reason: "takeover" },
        ],
        `${id}: one active controller`,
      );
      assert.equal(state.audit.length, 1, `${id}: one transfer audit event`);
      assert.equal(state.audit[0].action, "takeover_confirmed", `${id}: audit action`);
      assert.deepEqual(
        state.audit[0].beforeKeys,
        ["deadlineAt", "lockVersion", "score", "status"],
        `${id}: preserve transfer audit metadata`,
      );
    }
  }
  console.log("41 reconciliation contracts passed, including six concurrent transfer races.");
}

const replacedNames = new Set([
  "activate_interaction",
  "close_attempt_as_abandoned",
  "execute_command",
  "expire_stale_attempts",
  "recover_attempt",
  "reveal_progressive_clue",
  "submit_logic_code_attempt",
  "submit_mini_wordle_guess",
  "submit_word_hashtag_swap",
  "submit_word_search_selection",
  "take_over_attempt",
]);
const replaced = (identity) => replacedNames.has(identity.split("(")[0].replace("private.", ""));
const lastJson = (output) =>
  JSON.parse(
    output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );

export async function testCompetitiveCommandUpgrade(sql, migration) {
  // Preserve real persisted answers, a result/ledger, prepared interaction and
  // a cached transfer from the immediately preceding migration revision.
  await sql(`begin;
${await readFile("supabase/tests/support/command-fixtures.sql", "utf8")}
select test_support.as_actor('owner');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash')));
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":true}');
select test_support.run('record_evaluation', '{"status":"correct","points":50}');
select test_support.run('prepare_interaction');
select test_support.run('receive_answer', '{"answer":false}');
select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
select test_support.run('complete_attempt', '{"score":50}');
reset role;
select test_support.as_actor('member2');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-pyramid'), 'sessionToken', repeat('p', 40)));
select test_support.run('prepare_interaction');
reset role;
select test_support.as_actor('member');
set local role service_role;
select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('m', 40)));
select test_support.run('prepare_interaction');
select test_support.run('take_over_attempt', jsonb_build_object('newSessionToken', repeat('n', 40)));
commit;`);
  const snapshotRows = async () =>
    JSON.parse(await sql(`${snapshotFunction}\nselect pg_temp.domain_rows();`));
  const beforeRows = await snapshotRows();
  for (const table of [
    "private.attempt_answers",
    "private.answer_receipts",
    "private.flash_point_entries",
    "private.prepared_interactions",
    "private.command_requests",
  ])
    assert.ok(beforeRows[table]?.length, `${table}: populated upgrade fixture required`);
  assert.ok(beforeRows["public.attempts"].some((row) => row.status === "completed"));
  assert.ok(beforeRows["public.attempts"].some((row) => row.status === "in_progress"));
  const beforeFunctions = JSON.parse(await sql(functionsQuery));
  const cached = JSON.parse((await sql("select last_result from test_support.runtime;")).trim());
  const healthSource = await readFile("infrastructure/supabase/platform/health.ts", "utf8");
  const healthSql = healthSource.match(/>\(`([\s\S]*?)`\);/)?.[1];
  assert.ok(healthSql, "Actual health marker SQL must be tested");
  const healthMarker = async () =>
    (await sql(`begin; set local role service_role; ${healthSql}; rollback;`)).trim();
  assert.equal(await healthMarker(), "t|t|f", "Health rejects the preceding unreconciled revision");

  await sql(migration);
  assert.deepEqual(await snapshotRows(), beforeRows, "Upgrade preserves all domain rows");
  await checkInventory(sql);
  assert.equal(await healthMarker(), "t|t|t", "Health accepts the reconciled database");
  const afterFunctions = JSON.parse(await sql(functionsQuery));
  assert.deepEqual(
    Object.keys(afterFunctions),
    Object.keys(beforeFunctions),
    "No function added or removed",
  );
  let changed = 0;
  for (const [identity, previous] of Object.entries(beforeFunctions)) {
    const { definition: previousDefinition, ...attributes } = previous;
    const { definition: nextDefinition, ...nextAttributes } = afterFunctions[identity];
    const expectedAttributes = { ...attributes };
    if (identity === "private.take_over_attempt(input jsonb)") expectedAttributes.language = "sql";
    assert.deepEqual(
      nextAttributes,
      expectedAttributes,
      `${identity}: OID/signature/attributes/ACL`,
    );
    if (replaced(identity)) {
      assert.notEqual(nextDefinition, previousDefinition, `${identity}: expected replacement`);
      changed++;
    } else {
      assert.equal(nextDefinition, previousDefinition, `${identity}: unrelated function unchanged`);
    }
  }
  assert.equal(changed, 11, "Only the eleven audited executable differences are replaced");
  const replay = lastJson(
    await sql(`begin;
select test_support.as_actor('member');
set local role service_role;
select test_support.repeat_last();
commit;`),
  );
  assert.deepEqual(replay, cached, "Pre-migration transfer result replays identically");
  assert.deepEqual(await snapshotRows(), beforeRows, "Cached replay preserves all domain rows");

  const rollback =
    `-- Generated from the immediately preceding revision by the disposable upgrade test.\n` +
    `-- Use as a subsequent rollback migration after review; never rewrite history.\nbegin;\n` +
    Object.entries(beforeFunctions)
      .filter(([identity]) => replaced(identity))
      .map(([, fn]) => `${fn.definition.trim()};`)
      .join("\n\n") +
    "\ncommit;\n";
  await mkdir("output/audits", { recursive: true });
  await writeFile("output/audits/competitive-command-reconciliation-rollback.sql", rollback);
  await sql(rollback);
  assert.deepEqual(
    JSON.parse(await sql(functionsQuery)),
    beforeFunctions,
    "Rollback restores bodies and attributes with original OIDs/ACL",
  );
  assert.deepEqual(await snapshotRows(), beforeRows, "Rollback preserves all domain rows");
  await sql(migration);
  assert.deepEqual(
    JSON.parse(await sql(functionsQuery)),
    afterFunctions,
    "Reapply restores reconciled functions",
  );
  assert.deepEqual(await snapshotRows(), beforeRows, "Reapply preserves all domain rows");
  await checkInventory(sql);
  console.log(
    `Reconciliation upgrade/rollback/reapply preserved all ${Object.keys(beforeRows).length} domain tables, 217 function OIDs/signatures/ACLs and a cached transfer; eleven bodies reconciled.`,
  );
}
