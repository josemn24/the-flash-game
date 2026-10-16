import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { testCompletionHealthContract } from "./test-completion-health-contract.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_library_upgrade_${randomUUID().replaceAll("-", "")}`;
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
async function suite(name, { fixtures = false, corrected = true, persist = false } = {}) {
  let source = await readFile(`supabase/tests/question_library_${name}.test.sql`, "utf8");
  for (const label of ["command", "question-library"]) {
    source = source.replace(`-- @${label}-fixtures`, () => (fixtures ? loadedFixtures[label] : ""));
  }
  if (persist) {
    assert.match(source, /rollback;\s*$/);
    source = source.replace(/rollback;\s*$/, "commit;");
  }
  const result = await sql(source);
  assert.match(result, /^1\.\.\d+$/m, `${name} has a TAP plan`);
  assert.doesNotMatch(result, /^Bail out!/m, `${name} does not abort`);
  if (corrected) assert.doesNotMatch(result, /^not ok/m, `${name} passes`);
  else {
    assert.equal(
      (result.match(/^not ok/gm) ?? []).length,
      name === "authorization" ? 11 : 8,
      `${name} reproduces exactly the known predecessor failures`,
    );
  }
  return result.match(/^1\.\.(\d+)$/m)[1];
}
const loadedFixtures = Object.fromEntries(
  await Promise.all(
    ["command", "question-library"].map(async (name) => [
      name,
      await readFile(`supabase/tests/support/${name}-fixtures.sql`, "utf8"),
    ]),
  ),
);
const catalog = `select jsonb_object_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  to_jsonb(p) - 'prosrc' || jsonb_build_object('body', p.prosrc))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and not exists (
    select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e');`;
const indices = `select jsonb_object_agg(n.nspname || '.' || c.relname,
  jsonb_build_object('oid',c.oid,'owner',c.relowner,'definition',pg_get_indexdef(c.oid),'options',c.reloptions))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='i' and n.nspname in ('public','private');`;
let created = false;
try {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const authorization = files.findIndex((name) =>
    name.endsWith("_question_library_detail_authorization.sql"),
  );
  const pagination = files.findIndex((name) => name.endsWith("_question_library_pagination.sql"));
  assert.ok(
    authorization > 0 && pagination === authorization + 1,
    "Two consecutive incremental library migrations",
  );
  assert.equal(
    files[authorization - 1],
    "20261015192008_attempt_command_handlers_refactor.sql",
    "Fixed predecessor revision",
  );
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  await sql(
    `begin;\n${(await Promise.all(files.slice(0, authorization).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );
  const assertions = await suite("characterization", { fixtures: true, persist: true });
  await suite("authorization", { corrected: false });
  await suite("pagination", { corrected: false });

  await sql(`begin;
    create table test_support.library_upgrade_attempts(label text primary key, state jsonb, last_result jsonb, last_input jsonb);
    select test_support.as_actor('owner');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',repeat('o',40)));
    select test_support.run('prepare_interaction');
    insert into test_support.library_upgrade_attempts select 'active',state,last_result,last_input from test_support.runtime;
    select test_support.as_actor('member');
    select test_support.run('start_attempt', jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',repeat('m',40)));
    do $$ begin for n in 1..2 loop
      perform test_support.run('prepare_interaction');
      perform test_support.run('receive_answer','{"answer":true}');
      perform test_support.run('record_evaluation','{"status":"correct","points":50}');
    end loop; end $$;
    select test_support.run('complete_attempt');
    insert into test_support.library_upgrade_attempts select 'completed',state,last_result,last_input from test_support.runtime;
    commit;`);
  const tables =
    await json(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r';`);
  const snapshot = `select jsonb_build_object(${tables
    .map(
      (table) => `'${table}',
    (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${table} t)`,
    )
    .join(",")});`;
  const beforeData = await json(snapshot);
  const beforeIndices = await json(indices);
  let beforeCatalog = await json(catalog);
  for (const [index, changed] of [
    [authorization, "private.question_version_detail("],
    [pagination, "private.read_superadmin_question_library("],
  ]) {
    await sql(await readFile(`supabase/migrations/${files[index]}`, "utf8"));
    assert.deepEqual(
      await json(snapshot),
      beforeData,
      `${files[index]} preserves every domain row`,
    );
    assert.deepEqual(
      await json(indices),
      beforeIndices,
      `${files[index]} preserves all index OIDs and definitions`,
    );
    const after = await json(catalog);
    assert.deepEqual(
      Object.keys(after).sort(),
      Object.keys(beforeCatalog).sort(),
      "No functions added or removed",
    );
    for (const [identity, previous] of Object.entries(beforeCatalog)) {
      assert.deepEqual(
        after[identity],
        identity.startsWith(changed) ? { ...previous, body: after[identity].body } : previous,
        `${identity}: OID, ACL, attributes and unrelated bodies preserved`,
      );
      if (identity.startsWith(changed))
        assert.notEqual(after[identity].body, previous.body, "Expected correction was applied");
    }
    beforeCatalog = after;
    await suite("authorization");
    await suite("pagination", { corrected: index === pagination });
  }
  await checkInventory(sql);
  await testCompletionHealthContract(sql);
  const replay = await json(`begin; select test_support.as_actor('superadmin');
    select jsonb_object_agg(label, case label
      when 'create' then public.create_superadmin_question_draft(input) = result
      when 'update' then public.update_superadmin_question_draft(input) = result
      when 'publish' then public.publish_superadmin_question(input) = result
      when 'archive' then public.archive_superadmin_question(input) = result end)
    from test_support.library_results where label in ('create','update','publish','archive'); commit;`);
  assert.deepEqual(
    replay,
    { create: true, update: true, publish: true, archive: true },
    "All pre-migration editorial results replay exactly",
  );
  assert.equal(
    await json(`begin; select test_support.as_actor('member');
    select to_json(private.complete_attempt(last_input) = last_result) from test_support.library_upgrade_attempts where label='completed'; commit;`),
    true,
    "Pre-migration completed attempt replays exactly",
  );
  assert.deepEqual(
    await json(snapshot),
    beforeData,
    "Replays add no audits, credits, versions or sessions",
  );
  await sql(`begin; select test_support.as_actor('owner');
    update test_support.runtime set state = (select state from test_support.library_upgrade_attempts where label='active');
    select test_support.run('receive_answer','{"answer":true}');
    select test_support.run('record_evaluation','{"status":"correct","points":50}');
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer','{"answer":true}');
    select test_support.run('record_evaluation','{"status":"correct","points":50}');
    select test_support.run('complete_attempt');
    select test_support.as_actor('superadmin');
    select public.create_superadmin_question_draft(jsonb_build_object('idempotencyKey','library-after-upgrade',
      'reason','Continue after upgrade','questionDefinitionId',(select result->'questionDefinitionId'
        from test_support.library_results where label='create'),
      'document',test_support.library_document('library-command-reference')));
    commit;`);
  assert.deepEqual(
    await json(`select jsonb_agg(jsonb_build_object('status',a.status,'score',a.score,
    'credits',(select count(*) from private.flash_point_entries e where e.attempt_id=a.id and e.entry_type='accreditation')) order by a.player_id)
    from public.attempts a;`),
    [
      { status: "completed", score: 100, credits: 1 },
      { status: "completed", score: 100, credits: 1 },
    ],
    "Active and completed attempts retain their scoring and accreditation contracts",
  );
  console.log(
    `Question library upgrade passed: ${assertions} fixed predecessor assertions, both defects reproduced, two corrections, unchanged rows/OIDs/ACLs/indices, health, exact replays and continued play/editing.`,
  );
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
