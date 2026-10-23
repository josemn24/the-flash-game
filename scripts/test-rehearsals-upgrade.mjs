import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { checkInventory } from "./supabase-security-inventory.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_rehearsals_upgrade_${randomUUID().replaceAll("-", "")}`;
function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
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
let created = false;
try {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const boundary = files.indexOf("20261020140000_challenge_rehearsals.sql");
  assert.ok(boundary > 0);
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  await sql(
    `begin;\n${(await Promise.all(files.slice(0, boundary).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );
  const fixtures = await readFile("supabase/tests/support/command-fixtures.sql", "utf8");
  await sql(`begin;\n${fixtures}
    select test_support.as_actor('owner');
    select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',repeat('o',40)));
    select test_support.run('prepare_interaction');
    select test_support.as_actor('member');
    select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash'),'sessionToken',repeat('m',40)));
    do $$ begin for n in 1..2 loop
      perform test_support.run('prepare_interaction');
      perform test_support.run('receive_answer','{"answer":true}');
      perform test_support.run('record_evaluation','{"status":"correct","points":50}');
    end loop; end $$;
    select test_support.run('complete_attempt');
    commit;`);
  const tables =
    await json(`select jsonb_agg(format('%I.%I',n.nspname,c.relname) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relname <> 'challenge_rehearsals';`);
  const snapshot = `select jsonb_build_object(${tables.map((table) => `'${table}',(select coalesce(jsonb_agg(to_jsonb(t) - 'difficulty' order by (to_jsonb(t) - 'difficulty')::text),'[]'::jsonb) from ${table} t)`).join(",")});`;
  const before = await json(snapshot);
  assert.equal(before["public.attempts"].length, 2);
  assert.ok(before["private.attempt_answers"].length > 0);
  assert.ok(before["private.flash_point_entries"].length > 0);
  await sql(`begin;\n${await readFile(`supabase/migrations/${files[boundary]}`, "utf8")}\ncommit;`);
  assert.deepEqual(
    await json(snapshot),
    before,
    "Upgrade preserves every existing row, including active attempts, answers and ledger",
  );
  await sql(`begin;
    select test_support.as_actor('superadmin');
    select private.set_challenge_rehearsal(jsonb_build_object('challengeVersionId',test_support.id('cv-flash'),
      'expectedUpdatedAt',(select updated_at from private.challenge_versions where id=test_support.id('cv-flash')),
      'sourceHash',private.read_editorial_rehearsal(test_support.id('cv-flash'))->>'sourceHash',
      'idempotencyKey','legacy-upgrade-binding','reason','Legacy fixture preserved in audit',
      'ref',jsonb_build_object('id','legacy-fixture','version',1,'contentHash',repeat('a',64))));
    commit;`);
  const withLegacyAssociation = await json(snapshot);
  assert.equal((await sql("select count(*) from private.challenge_rehearsals;")).trim(), "1");
  await sql(
    `begin;\n${(await Promise.all(files.slice(boundary + 1).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );
  assert.deepEqual(
    await json(snapshot),
    withLegacyAssociation,
    "Dynamic upgrade preserves all competitive rows and audit history",
  );
  assert.equal(
    (
      await sql("select count(*) from private.question_versions where difficulty <> 'medium';")
    ).trim(),
    "0",
  );
  assert.equal(
    (await sql("select to_regclass('private.challenge_rehearsals') is null;")).trim(),
    "t",
  );

  await checkInventory(sql);
  console.log(
    `Rehearsal upgrade verified: ${tables.length} existing tables preserved, active and completed attempts unchanged, dynamic templates and medium difficulty backfill.`,
  );
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
