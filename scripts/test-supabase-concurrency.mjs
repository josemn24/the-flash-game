import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

const id = (label) => {
  const hex = createHash("md5").update(`commands:${label}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const lastJson = (output) =>
  JSON.parse(
    output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .at(-1),
  );

export async function testConcurrentCommands(sql) {
  await sql(
    `begin; ${await readFile("supabase/tests/support/command-fixtures.sql", "utf8")} commit;`,
  );
  async function invoke(actor, command, input, hold = false, role = "service_role", schema = "private") {
    const marker = `flash_concurrency_${randomUUID().replaceAll("-", "")}`;
    const operation =
      sql(`begin; set local application_name = ${quote(marker)}; set local role ${role};
      select set_config('request.jwt.claims', ${quote(JSON.stringify({ sub: id(`auth-${actor}`) }))}, true);
      select ${schema}.${command}(${quote(JSON.stringify(input))}::jsonb);
      ${hold ? "select pg_sleep(1.5);" : ""} commit;`);
    // Observe rejection immediately while the barrier is polling; callers still receive the error.
    operation.catch(() => {});
    // Observe PgSleep only AFTER the command acquired its locks and returned a result.
    // The second connection then runs while those locks are still held.
    if (hold) {
      let sleeping = false;
      for (let tries = 0; tries < 40; tries++) {
        sleeping =
          (
            await sql(
              `select exists(select 1 from pg_stat_activity where application_name=${quote(marker)} and wait_event='PgSleep');`,
            )
          ).trim() === "t";
        if (sleeping) break;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      if (!sleeping) {
        await operation;
        throw new Error("Concurrency barrier was not reached");
      }
    }
    return { done: operation.then(lastJson) };
  }
  async function run(actor, command, input) {
    return (await invoke(actor, command, input)).done;
  }
  async function race(actor1, actor2, command, firstInput, secondInput, options = {}) {
    const first = await invoke(actor1, command, firstInput, true, options.role, options.schema);
    const second = await invoke(actor2, command, secondInput, false, options.role, options.schema);
    return Promise.allSettled([first.done, second.done]);
  }
  const requireOneConflict = (outcomes, message) => {
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1, message);
    assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1, message);
  };

  const seasonRaceRoom = id("season-race-room");
  const seasonRaceOne = id("season-race-one");
  const seasonRaceTwo = id("season-race-two");
  await sql(`begin;
    insert into public.rooms(id, slug, title, description, time_zone, status)
    values (${quote(seasonRaceRoom)}, 'concurrent-season-room', 'Concurrent season room', '', 'UTC', 'active');
    insert into public.room_memberships(room_id, player_id, role)
    values (${quote(seasonRaceRoom)}, ${quote(id("owner"))}, 'owner');
    insert into public.seasons(id, room_id, title, status, starts_at, ends_at)
    values
      (${quote(seasonRaceOne)}, ${quote(seasonRaceRoom)}, 'Concurrent season one', 'draft', now() + interval '1 day', now() + interval '5 days'),
      (${quote(seasonRaceTwo)}, ${quote(seasonRaceRoom)}, 'Concurrent season two', 'draft', now() + interval '1 day', now() + interval '5 days');
    commit;`);
  const seasonActivations = await race(
    "superadmin",
    "superadmin",
    "activate_superadmin_season",
    { idempotencyKey: "concurrent-season-1", seasonId: seasonRaceOne, reason: "race one" },
    { idempotencyKey: "concurrent-season-2", seasonId: seasonRaceTwo, reason: "race two" },
    { role: "authenticated", schema: "public" },
  );
  requireOneConflict(seasonActivations, "Only one concurrent season activation succeeds");
  assert.equal(
    (await sql(`select count(*) from public.seasons where room_id=${quote(seasonRaceRoom)} and status='active';`)).trim(),
    "1",
    "Concurrent season activation leaves exactly one active season",
  );

  const starts = await race(
    "owner",
    "owner",
    "start_attempt",
    {
      scheduledChallengeId: id("sc-flash"),
      sessionToken: "c".repeat(40),
      idempotencyKey: "concurrent-start-1",
    },
    {
      scheduledChallengeId: id("sc-flash"),
      sessionToken: "d".repeat(40),
      idempotencyKey: "concurrent-start-2",
    },
  );
  assert.ok(
    starts.every((r) => r.status === "fulfilled"),
    "Both starts resolve the same official attempt",
  );
  const a = starts[0].value;
  assert.equal(starts[1].value.attemptId, a.attemptId);
  assert.equal(
    starts[1].value.controlRequired,
    true,
    "A second session is blocked without taking control",
  );
  assert.equal((await sql("select count(*) from public.attempts;")).trim(), "1");
  assert.equal(
    (await sql("select count(*) from private.attempt_sessions where revoked_at is null;")).trim(),
    "1",
    "The original session remains the only controller",
  );

  const invites = await race(
    "outsider",
    "superadmin",
    "accept_invitation",
    { invitationToken: "i".repeat(40), idempotencyKey: "invite-race-1" },
    { invitationToken: "i".repeat(40), idempotencyKey: "invite-race-2" },
  );
  requireOneConflict(invites, "Only one claimant consumes the last invitation use");
  assert.equal((await sql("select use_count from private.room_invitations;")).trim(), "1");

  const prepared = await run("owner", "prepare_interaction", {
    attemptId: a.attemptId,
    lockVersion: 1,
    sessionToken: "c".repeat(40),
    idempotencyKey: "prepare-concurrent",
  });
  const response = {
    attemptId: a.attemptId,
    lockVersion: prepared.lockVersion,
    sessionToken: "c".repeat(40),
    challengeItemId: prepared.challengeItemId,
    answer: true,
    idempotencyKey: "same-response",
  };
  const answers = await race("owner", "owner", "receive_answer", response, response);
  assert.ok(answers.every((r) => r.status === "fulfilled"));
  assert.deepEqual(
    answers[0].value,
    answers[1].value,
    "Concurrent retries return the same receipt",
  );
  assert.equal((await sql("select count(*) from private.answer_receipts;")).trim(), "1");

  // Early termination is allowed for survival, and the trusted evaluator determines its outcome.
  const b = await run("member", "start_attempt", {
    scheduledChallengeId: id("sc-survival"),
    sessionToken: "g".repeat(40),
    idempotencyKey: "survival-start",
  });
  const p = await run("member", "prepare_interaction", {
    attemptId: b.attemptId,
    lockVersion: b.lockVersion,
    sessionToken: "g".repeat(40),
    idempotencyKey: "survival-prepare",
  });
  const r = await run("member", "receive_answer", {
    attemptId: b.attemptId,
    lockVersion: p.lockVersion,
    sessionToken: "g".repeat(40),
    challengeItemId: p.challengeItemId,
    answer: false,
    idempotencyKey: "survival-answer",
  });
  const e = await run("member", "record_evaluation", {
    attemptId: b.attemptId,
    lockVersion: r.lockVersion,
    sessionToken: "g".repeat(40),
    receiptId: r.receiptId,
    status: "incorrect",
    points: 0,
    idempotencyKey: "survival-evaluate",
  });
  const complete = await invoke(
    "member",
    "complete_attempt",
    {
      attemptId: b.attemptId,
      lockVersion: e.lockVersion,
      sessionToken: "g".repeat(40),
      score: 0,
      outcome: "eliminated",
      idempotencyKey: "survival-complete",
    },
    true,
  );
  const invalidate = await invoke("superadmin", "invalidate_attempt", {
    attemptId: b.attemptId,
    lockVersion: e.lockVersion + 1,
    reason: "concurrency test",
    idempotencyKey: "survival-invalidate",
  });
  await Promise.all([complete.done, invalidate.done]);
  assert.equal(
    (await sql(`select status from public.attempts where id=${quote(b.attemptId)};`)).trim(),
    "invalidated",
  );
  assert.equal(
    (
      await sql(
        `select count(*) from private.flash_point_entries where attempt_id=${quote(b.attemptId)};`,
      )
    ).trim(),
    "2",
    "Zero credit also has a zero reversal",
  );
  assert.equal(
    (
      await sql(
        `select count(*) from private.audit_log where entity_id=${quote(b.attemptId)} and action in ('complete','invalidate');`,
      )
    ).trim(),
    "2",
  );
}
