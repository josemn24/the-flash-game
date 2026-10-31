import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { checkInventory } from "./supabase-security-inventory.mjs";
import { sessionFixture } from "./fixtures/scenarios/competitive-session-fixture.mjs";
import { connectPairsQuestions } from "./fixtures/scenarios/time-trial-connect-pairs.mjs";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_checkpoint_upgrade_${randomUUID().replaceAll("-", "")}`;
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const id = (label) => {
  const hex = createHash("md5").update(`commands:${label}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
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
const firstPair = connectPairsQuestions[0].publicPayload.pairs[0];
const pairPath = connectPairsQuestions[0].solution.paths[firstPair.id];
const draft = { paths: { [firstPair.id]: pairPath.slice(0, 2) } };
const single = { paths: { [firstPair.id]: [pairPath[0]] } };
let created = false;
try {
  const files = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const target = files.findIndex((name) =>
    name.endsWith("_checkpoint_execution_and_review_fixes.sql"),
  );
  assert.ok(target > 0, "Checkpoint correction has a predecessor");
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  await sql(
    `begin;\n${(await Promise.all(files.slice(0, target).map((name) => readFile(`supabase/migrations/${name}`, "utf8")))).join("\n")}\ncommit;`,
  );
  const fixtures = await Promise.all(
    ["command", "pyramid-queens", "time-trial"].map((name) =>
      readFile(`supabase/tests/support/${name}-fixtures.sql`, "utf8"),
    ),
  );
  await sql(
    `begin;\n${fixtures.join("\n")}\ncreate table test_support.checkpoint_upgrade(label text primary key, state jsonb not null); commit;`,
  );
  const cp = sessionFixture({
    id: "checkpoint-upgrade",
    mode: "time-trial",
    title: "Checkpoint upgrade",
    globalTimeLimitMs: 1000,
    questions: connectPairsQuestions,
  });
  await sql(
    cp.buildDomainSql({
      accounts: { alice: { playerId: id("owner") }, bob: { playerId: id("member") } },
      sqlString: quote,
      sqlUuid: (label) => quote(id(`checkpoint-upgrade-${label}`)),
    }),
  );
  await sql(`begin;
    select test_support.as_actor('owner'); set local role service_role;
    select test_support.start_ct(4);
    select test_support.run('save_queens_draft','{"queens":[2,9,10]}');
    select test_support.run('recover_attempt'); reset role;
    insert into test_support.checkpoint_upgrade select 'queens',state from test_support.runtime;
    set local role service_role;
    select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',${quote(id("checkpoint-upgrade-publication"))}::uuid,'sessionToken',repeat('c',40)));
    select test_support.run('prepare_interaction');
    select test_support.run('save_connect_pairs_draft',${quote(JSON.stringify(draft))}::jsonb);
    select test_support.run('recover_attempt'); reset role;
    insert into test_support.checkpoint_upgrade select 'connect-pairs',state from test_support.runtime;
    commit;`);
  const snapshots = `select jsonb_build_object(
    'attempts',(select jsonb_agg(to_jsonb(a) order by id) from public.attempts a),
    'receipts',(select jsonb_agg(to_jsonb(r) order by id) from private.answer_receipts r),
    'sessions',(select jsonb_agg(to_jsonb(s) order by id) from private.attempt_sessions s),
    'answers',(select jsonb_agg(to_jsonb(a) order by id) from private.attempt_answers a),
    'credits',(select jsonb_agg(to_jsonb(e) order by id) from private.flash_point_entries e));`;
  const metadata = `select jsonb_agg(jsonb_build_object('name',proname,'owner',proowner,'acl',proacl,'security',prosecdef,'settings',proconfig,'result',pg_get_function_result(oid)) order by proname)
    from pg_proc where pronamespace='private'::regnamespace and proname in ('connect_pairs_draft_valid','handle_attempt_closure');`;
  const before = await json(snapshots),
    beforeMetadata = await json(metadata);
  await sql(await readFile(`supabase/migrations/${files[target]}`, "utf8"));
  assert.deepEqual(
    await json(snapshots),
    before,
    "Correction preserves all existing attempt, receipt, session, answer and credit rows",
  );
  assert.deepEqual(
    await json(metadata),
    beforeMetadata,
    "Correction preserves signatures and privileges",
  );
  await checkInventory(sql);
  assert.equal(
    await json(
      `select to_jsonb(private.connect_pairs_draft_valid(${quote(JSON.stringify(connectPairsQuestions[0].publicPayload))}::jsonb,${quote(JSON.stringify(single))}::jsonb));`,
    ),
    true,
  );
  await sql("select pg_sleep(1.05);");
  for (const format of ["queens", "connect-pairs"]) {
    await sql(`begin;
      select test_support.as_actor('owner');
      update test_support.runtime set state=(select state from test_support.checkpoint_upgrade where label=${quote(format)});
      set local role service_role;
      select test_support.run('complete_attempt',jsonb_build_object('pendingEvaluation',jsonb_build_object('receiptId',(select state->'receiptId' from test_support.runtime),'status','unanswered','points',0)));
      do $$ begin if test_support.repeat_last() is distinct from (select last_result from test_support.runtime) then raise exception 'Closure replay differs'; end if; end $$;
      commit;`);
    const result =
      await json(`select jsonb_build_object('snapshot',a.review_state,'answer',a.answer,'points',a.points,'answers',(select count(*) from private.attempt_answers where attempt_id=a.attempt_id),'credits',(select count(*) from private.flash_point_entries where attempt_id=a.attempt_id),'progress',(select progress_payload from public.attempts where id=a.attempt_id))
      from private.attempt_answers a where attempt_id=(select (state->>'attemptId')::uuid from test_support.runtime);`);
    assert.deepEqual(
      result.snapshot,
      format === "queens" ? { type: format, queens: [2, 9, 10] } : { type: format, ...draft },
    );
    assert.equal(result.answer, null);
    assert.equal(result.points, 0);
    assert.equal(result.answers, 1);
    assert.equal(result.credits, 1);
    assert.equal(result.progress, null);
    console.log(
      `${format}: predecessor receipt closes with its checkpoint, identical replay and one accreditation.`,
    );
  }
  console.log("Checkpoint migration upgrade passed; existing rows and privileges preserved.");
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
