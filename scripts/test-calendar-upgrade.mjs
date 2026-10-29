import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { checkInventory } from "./supabase-security-inventory.mjs";

const exec = promisify(execFile);
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_the-flash-game";
const database = `flash_calendar_upgrade_${randomUUID().replaceAll("-", "")}`;
const docker = async (args, input = "") => {
  const child = exec("docker", ["exec", "-i", container, ...args], { maxBuffer: 50 * 1024 * 1024 });
  child.child.stdin.end(input);
  return (await child).stdout;
};
const sql = (input) =>
  docker(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], input);
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const json = (output) =>
  JSON.parse(
    output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );
let created = false;
try {
  await docker(["createdb", "-U", "postgres", database]);
  created = true;
  await sql(await readFile("supabase/tests/support/bootstrap.sql", "utf8"));
  const migrations = (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const boundary = migrations.findIndex((file) => file.endsWith("_safe_calendar_changes.sql"));
  assert.ok(boundary > 0, "Calendar migration exists after the baseline");
  const sources = await Promise.all(
    migrations.map((file) => readFile(`supabase/migrations/${file}`, "utf8")),
  );
  await sql(`begin; ${sources.slice(0, boundary).join("\n")} commit;`);
  await sql(`begin; ${await readFile("supabase/tests/support/command-fixtures.sql", "utf8")}
    select test_support.as_actor('owner');
    select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-flash')));
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer','{"answer":true}');
    select test_support.run('record_evaluation','{"status":"correct","points":50}');
    select test_support.run('prepare_interaction');
    select test_support.run('receive_answer','{"answer":true}');
    select test_support.run('record_evaluation','{"status":"correct","points":50}');
    select test_support.run('complete_attempt');
    select test_support.as_actor('member');
    select test_support.run('start_attempt',jsonb_build_object('scheduledChallengeId',test_support.id('sc-alphabet'),'sessionToken',repeat('m',40)));
    commit;`);
  const facts = [
    "public.seasons",
    "public.scheduled_challenges",
    "public.attempts",
    "private.attempt_sessions",
    "private.attempt_answers",
    "private.flash_point_entries",
    "private.room_measurement_events",
    "private.room_measurement_ratings",
  ];
  const snapshot = `select jsonb_build_object(${facts.map((table) => `${quote(table)},(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from ${table} t)`).join(",")});`;
  const before = await sql(snapshot);
  await sql(`begin; ${sources.slice(boundary).join("\n")} commit;`);
  assert.deepEqual(
    await sql(snapshot),
    before,
    "Migration preserves schedules, attempts, clocks, scoring and observation facts",
  );
  await checkInventory(sql);
  console.log(
    "Calendar upgrade preserves existing competition and matches the security inventory.",
  );

  const claims = async (actor) =>
    (await sql(`select jsonb_build_object('sub',test_support.id('auth-${actor}'))`)).trim();
  const operator = await claims("superadmin");
  const member = await claims("member2");
  const proposalFor = async (label) =>
    json(
      await sql(`select jsonb_build_object('seasonId',s.id,'expectedUpdatedAt',s.updated_at,'startsAt',s.starts_at,'endsAt',s.ends_at,
    'publications',(select jsonb_agg(jsonb_build_object('scheduledChallengeId',p.id,'expectedUpdatedAt',p.updated_at,'opensAt',p.opens_at,'closesAt',p.closes_at+interval '5 minutes'))
      from public.scheduled_challenges p where p.season_id=s.id)) from public.seasons s where s.id=test_support.id('${label}');`),
    );
  const apply = (proposal, key, hold = false) =>
    sql(`begin; set local role authenticated;
    select set_config('request.jwt.claims',${quote(operator)},true);
    select public.apply_superadmin_calendar_change(${quote(JSON.stringify({ ...proposal, idempotencyKey: key, reason: "Concurrency verification" }))}::jsonb);
    ${hold ? "select pg_sleep(1);" : ""} commit;`);
  // Return the pending promise inside an object so async does not await the transaction.
  async function holdRoom(label) {
    const marker = `calendar_room_${randomUUID().replaceAll("-", "")}`;
    const pending = sql(
      `begin; set local application_name=${quote(marker)}; select 1 from public.rooms where id=test_support.id('${label}') for update; select pg_sleep(1); commit;`,
    );
    pending.catch(() => {});
    for (let n = 0; n < 100; n++) {
      if (
        (
          await sql(
            `select exists(select 1 from pg_stat_activity where application_name=${quote(marker)} and wait_event='PgSleep')`,
          )
        ).trim() === "t"
      )
        return { done: pending };
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await pending;
    throw new Error("Room barrier not reached");
  }
  const proposal = await proposalFor("season-survival");
  const held = await holdRoom("room-survival");
  const outcomes = await Promise.allSettled([
    apply(proposal, "calendar-race-a"),
    apply(proposal, "calendar-race-b"),
  ]);
  await held.done;
  assert.equal(
    outcomes.filter((outcome) => outcome.status === "fulfilled").length,
    1,
    "Only one stale-calendar writer wins",
  );
  assert.match(
    outcomes.find((outcome) => outcome.status === "rejected").reason.message,
    /schedule_conflict/,
  );

  const startProposal = await proposalFor("season-narrative");
  const roomLock = await holdRoom("room-narrative");
  const edit = apply(startProposal, "calendar-start-race");
  const start =
    sql(`begin; set local role service_role; select set_config('request.jwt.claims',${quote(member)},true);
    select private.start_attempt(jsonb_build_object('scheduledChallengeId',test_support.id('sc-narrative'),'sessionToken',repeat('c',40),'idempotencyKey','calendar-concurrent-start')); commit;`);
  const startOutcomes = await Promise.allSettled([edit, start]);
  await roomLock.done;
  assert.ok(
    startOutcomes.every((outcome) => outcome.status === "fulfilled"),
    "Start and extension serialize without deadlocks",
  );

  await sql(`begin;
    insert into public.rooms(id,slug,title) values(test_support.id('calendar-boundary-room'),'calendar-boundary','Boundary');
    insert into public.room_memberships(room_id,player_id,role) values(test_support.id('calendar-boundary-room'),test_support.id('owner'),'owner');
    insert into public.seasons(id,room_id,title,status,starts_at,ends_at) values(test_support.id('calendar-live-boundary'),test_support.id('calendar-boundary-room'),'Live boundary','active',now()-interval '1 minute',now()+interval '1 day');
    insert into public.scheduled_challenges(id,season_id,challenge_version_id,number,opens_at,closes_at)
      values(test_support.id('calendar-live-boundary-publication'),test_support.id('calendar-live-boundary'),test_support.id('cv-flash'),1,now()+interval '500 milliseconds',now()+interval '10 minutes');
    commit;`);
  const boundaryProposal = await proposalFor("calendar-live-boundary");
  boundaryProposal.publications[0].opensAt = new Date(Date.now() + 120_000).toISOString();
  const boundaryLock = await holdRoom("calendar-boundary-room");
  await assert.rejects(
    apply(boundaryProposal, "calendar-after-opening"),
    /opening_reached/,
    "A proposal cannot postpone an opening reached while waiting",
  );
  await boundaryLock.done;
  const tickProposal = await proposalFor("calendar-live-boundary");
  const tickLock = await holdRoom("calendar-boundary-room");
  const tickRace = await Promise.allSettled([
    apply(tickProposal, "calendar-tick-race"),
    sql(
      `begin; set local role service_role; select public.run_calendar_tick('{"runId":"calendar-concurrent-tick"}'); commit;`,
    ),
  ]);
  await tickLock.done;
  assert.equal(tickRace[1].status, "fulfilled", "The tick completes without deadlocks");
  if (tickRace[0].status === "rejected") {
    assert.match(
      tickRace[0].reason.message,
      /schedule_conflict/,
      "An opening tick invalidates the old preview instead of overwriting it",
    );
  }
  console.log(
    "Calendar races passed: concurrent edits, gameplay start, opening after lock wait, and calendar tick.",
  );
} finally {
  if (created) await docker(["dropdb", "-U", "postgres", "--force", database]);
}
