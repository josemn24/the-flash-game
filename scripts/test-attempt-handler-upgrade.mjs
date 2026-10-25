import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { testCompletionHealthContract } from "./test-completion-health-contract.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_handler_upgrade_${randomUUID().replaceAll("-", "")}`;
function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      out += data;
    });
    child.stderr.on("data", (data) => {
      err += data;
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${err}\n${out}`))));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
const sql = (source) =>
  docker(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], source);
const json = async (source) => JSON.parse((await sql(source)).trim());
const catalog = `select jsonb_object_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  jsonb_build_object('oid', p.oid, 'owner', p.proowner, 'acl', p.proacl,
    'language', p.prolang, 'settings', p.proconfig, 'definer', p.prosecdef,
    'volatility', p.provolatile, 'result', pg_get_function_result(p.oid), 'body', p.prosrc))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and not exists (
    select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');`;
let created = false;
try {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const target = files.findIndex((name) => name.endsWith("_attempt_command_handlers_refactor.sql"));
  assert.ok(target > 0, "The incremental refactor migration has a predecessor");
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  await sql(
    `begin;\n${(await Promise.all(files.slice(0, target).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );

  // Run the same fixed expectations on the installed predecessor before loading upgrade fixtures.
  let characterization = await readFile(
    "supabase/tests/attempt_handler_characterization.test.sql",
    "utf8",
  );
  for (const name of ["command", "pyramid-queens", "time-trial"]) {
    const fixture = await readFile(`supabase/tests/support/${name}-fixtures.sql`, "utf8");
    characterization = characterization.replace(`-- @${name}-fixtures`, () => fixture);
  }
  const beforeResult = await sql(characterization);
  assert.match(beforeResult, /^1\.\.\d+$/m, "Predecessor characterization has a TAP plan");
  assert.doesNotMatch(
    beforeResult,
    /^not ok|^Bail out!/m,
    "Predecessor characterization passes unchanged",
  );

  const fixtures = await readFile("supabase/tests/support/command-fixtures.sql", "utf8");
  await sql(`begin; ${fixtures}
    create table test_support.upgrade_saved as select ''::text as label, runtime.* from test_support.runtime where false;
    create function test_support.save_upgrade(target_label text) returns void language sql as $$
      insert into test_support.upgrade_saved select target_label, runtime.* from test_support.runtime
    $$;
    create function test_support.restore_upgrade(target_label text) returns void language sql as $$
      update test_support.runtime r set state = s.state, last_command = s.last_command,
        last_input = s.last_input, last_result = s.last_result
      from test_support.upgrade_saved s where s.label = target_label
    $$;
    select test_support.as_actor('owner');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash')));
    do $$ begin for n in 1..2 loop
      perform test_support.run('prepare_interaction');
      perform test_support.run('receive_answer', '{"answer":true}');
      perform test_support.run('record_evaluation', '{"status":"correct","points":50}');
    end loop; end $$;
    select test_support.run('complete_attempt');
    select test_support.save_upgrade('completed');
    select test_support.as_actor('member');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-flash'), 'sessionToken', repeat('m',40)));
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer', '{"answer":true}');
    select test_support.run('take_over_attempt', jsonb_build_object('newSessionToken', repeat('t',40)));
    select test_support.save_upgrade('pending');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-pyramid'), 'sessionToken', repeat('p',40)));
    select test_support.run('prepare_interaction');
    select test_support.save_upgrade('prepared');
    select test_support.as_actor('member2');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId', test_support.id('sc-narrative'), 'sessionToken', repeat('n',40)));
    select test_support.run('prepare_interaction');
    select test_support.save_upgrade('active');
    commit;`);
  const beforeCatalog = await json(catalog);
  const tables =
    await json(`select jsonb_agg(format('%I.%I', n.nspname, c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind='r';`);
  const snapshot = `select jsonb_build_object(${tables
    .map(
      (table) => `'${table}',
    (select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text), '[]'::jsonb) from ${table} r)`,
    )
    .join(",")});`;
  const beforeData = await json(snapshot);
  await sql(await readFile(`supabase/migrations/${files[target]}`, "utf8"));
  assert.deepEqual(
    await json(snapshot),
    beforeData,
    "Migration preserves every persisted domain row byte for byte",
  );
  const afterCatalog = await json(catalog);
  for (const [identity, before] of Object.entries(beforeCatalog)) {
    const after = afterCatalog[identity];
    assert.ok(after, `${identity} is preserved`);
    const expected = identity.startsWith("private.handle_attempt_command(")
      ? { ...before, body: after.body }
      : before;
    assert.deepEqual(
      after,
      expected,
      `${identity}: preserve OID, ACL, attributes and all unrelated bodies`,
    );
  }
  assert.equal(
    Object.keys(afterCatalog).length - Object.keys(beforeCatalog).length,
    7,
    "Only seven private operations are added",
  );

  // Completed results and the old transfer can be replayed without new audit, sessions or credits.
  const replay = await json(`begin;
    select test_support.as_actor('owner'); select test_support.restore_upgrade('completed');
    select to_json(test_support.repeat_last() = (select last_result from test_support.runtime)); commit;`);
  assert.equal(replay, true, "Pre-migration completion replays exactly");
  const transferReplay = await json(`begin;
    select test_support.as_actor('member'); select test_support.restore_upgrade('pending');
    select to_json(test_support.repeat_last() = (select last_result from test_support.runtime)); commit;`);
  assert.equal(transferReplay, true, "Pre-migration transfer replays exactly");
  assert.deepEqual(await json(snapshot), beforeData, "Cross-upgrade replays have no domain writes");

  await sql(`begin;
    select test_support.as_actor('member'); select test_support.restore_upgrade('pending');
    select test_support.run('record_evaluation', '{"status":"correct","points":50}');
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer', '{"answer":true}');
    select test_support.run('record_evaluation', '{"status":"correct","points":50}');
    select test_support.run('complete_attempt');
    select test_support.restore_upgrade('prepared');
    select test_support.run('activate_interaction');
    select test_support.run('receive_answer', '{"answer":"B"}');
    select test_support.run('record_evaluation', '{"status":"incorrect","points":0}');
    select test_support.run('complete_attempt');
    select test_support.as_actor('member2'); select test_support.restore_upgrade('active');
    select test_support.run('abandon_attempt');
    commit;`);
  assert.deepEqual(
    await json(`select jsonb_agg(jsonb_build_object('label', s.label,
      'status', a.status, 'score', a.score, 'outcome', a.outcome,
      'activeSessions', (select count(*) from private.attempt_sessions x where x.attempt_id=a.id and revoked_at is null),
      'credits', (select count(*) from private.flash_point_entries e where e.attempt_id=a.id and entry_type='accreditation')) order by s.label)
    from test_support.upgrade_saved s join public.attempts a on a.id=(s.state->>'attemptId')::uuid;`),
    [
      {
        label: "active",
        status: "abandoned",
        score: null,
        outcome: null,
        activeSessions: 0,
        credits: 0,
      },
      {
        label: "completed",
        status: "completed",
        score: 100,
        outcome: null,
        activeSessions: 0,
        credits: 1,
      },
      {
        label: "pending",
        status: "completed",
        score: 100,
        outcome: null,
        activeSessions: 0,
        credits: 1,
      },
      {
        label: "prepared",
        status: "completed",
        score: 0,
        outcome: "failed",
        activeSessions: 0,
        credits: 1,
      },
    ],
    "All pre-existing attempts continue with the same terminal and scoring contracts",
  );
  // Historical assertions above target that migration's schema. Compare today's
  // inventory and health only after loading all subsequent migrations.
  await sql(
    `begin;\n${(await Promise.all(files.slice(target + 1).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );
  await checkInventory(sql);
  await testCompletionHealthContract(sql);
  console.log(
    "Attempt handler upgrade passed: predecessor characterization, unchanged rows/OIDs/ACLs, health, replay and continued play.",
  );
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
