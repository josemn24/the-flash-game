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

  const editorialDefinition = id("s11-concurrent-definition");
  const editorialVersion = id("s11-concurrent-version");
  const editorialQuestionDefinitionOne = id("s11-concurrent-question-definition-one");
  const editorialQuestionDefinitionTwo = id("s11-concurrent-question-definition-two");
  const editorialQuestionVersionOne = id("s11-concurrent-question-version-one");
  const editorialQuestionVersionTwo = id("s11-concurrent-question-version-two");
  const editorialItemOne = id("s11-concurrent-item-one");
  const editorialItemTwo = id("s11-concurrent-item-two");
  await sql(`begin;
    insert into private.challenge_definitions(id, slug, created_by_player_id)
    values (${quote(editorialDefinition)}, 's11-concurrent-definition', ${quote(id("superadmin"))});
    insert into private.challenge_versions(id, challenge_definition_id, version_number, config_schema_version,
      status, mode, title, subtitle, description, max_score, mode_config, created_by_player_id)
    values (${quote(editorialVersion)}, ${quote(editorialDefinition)}, 1, 1, 'draft', 'flash',
      'Concurrent Flash', 'Dos preguntas', 'Concurrente', 100, '{}'::jsonb, ${quote(id("superadmin"))});
    insert into private.question_definitions(id, slug, created_by_player_id)
    values
      (${quote(editorialQuestionDefinitionOne)}, 's11-concurrent-question-one', ${quote(id("superadmin"))}),
      (${quote(editorialQuestionDefinitionTwo)}, 's11-concurrent-question-two', ${quote(id("superadmin"))});
    insert into private.question_versions(id, question_definition_id, version_number, payload_schema_version,
      status, type, time_limit_ms, public_payload, created_by_player_id)
    values
      (${quote(editorialQuestionVersionOne)}, ${quote(editorialQuestionDefinitionOne)}, 1, 1, 'draft', 'multiple-choice', 15000,
        '{"question":"¿Uno?","options":["A","B"],"category":"Test","tags":{},"media":null,"promptVisual":null}'::jsonb, ${quote(id("superadmin"))}),
      (${quote(editorialQuestionVersionTwo)}, ${quote(editorialQuestionDefinitionTwo)}, 1, 1, 'draft', 'multiple-choice', 15000,
        '{"question":"¿Dos?","options":["A","B"],"category":"Test","tags":{},"media":null,"promptVisual":null}'::jsonb, ${quote(id("superadmin"))});
    insert into private.question_version_solutions(question_version_id, solution_payload)
    values
      (${quote(editorialQuestionVersionOne)}, '{"correctAnswer":"A","explanation":"A"}'::jsonb),
      (${quote(editorialQuestionVersionTwo)}, '{"correctAnswer":"B","explanation":"B"}'::jsonb);
    insert into private.challenge_items(id, challenge_version_id, question_version_id, position, points, config_schema_version, mode_config)
    values
      (${quote(editorialItemOne)}, ${quote(editorialVersion)}, ${quote(editorialQuestionVersionOne)}, 1, 50, 1, '{}'::jsonb),
      (${quote(editorialItemTwo)}, ${quote(editorialVersion)}, ${quote(editorialQuestionVersionTwo)}, 2, 50, 1, '{}'::jsonb);
    commit;`);
  const editorialUpdatedAt = (
    await sql(`select updated_at::text from private.challenge_versions where id=${quote(editorialVersion)};`)
  ).trim();
  const editorialDocument = (title) => ({
    challenge: {
      slug: "s11-concurrent-definition",
      title,
      subtitle: "Dos preguntas",
      description: "Concurrente",
      mode: "flash",
      configSchemaVersion: 1,
      modeConfig: {},
    },
    questions: [
      {
        slug: "s11-concurrent-question-one",
        type: "multiple-choice",
        payloadSchemaVersion: 1,
        timeLimitMs: 15000,
        points: 50,
        publicPayload: {
          question: "¿Uno?",
          options: ["A", "B"],
          category: "Test",
          tags: {},
          media: null,
          promptVisual: null,
        },
        solutionPayload: { correctAnswer: "A", explanation: "A" },
      },
      {
        slug: "s11-concurrent-question-two",
        type: "multiple-choice",
        payloadSchemaVersion: 1,
        timeLimitMs: 15000,
        points: 50,
        publicPayload: {
          question: "¿Dos?",
          options: ["A", "B"],
          category: "Test",
          tags: {},
          media: null,
          promptVisual: null,
        },
        solutionPayload: { correctAnswer: "B", explanation: "B" },
      },
    ],
  });
  const editorialUpdates = await race(
    "superadmin",
    "superadmin",
    "update_superadmin_flash_draft",
    {
      idempotencyKey: "s11-concurrent-update-one",
      challengeVersionId: editorialVersion,
      expectedUpdatedAt: editorialUpdatedAt,
      document: editorialDocument("Concurrent winner"),
      reason: "Concurrent update one",
    },
    {
      idempotencyKey: "s11-concurrent-update-two",
      challengeVersionId: editorialVersion,
      expectedUpdatedAt: editorialUpdatedAt,
      document: editorialDocument("Concurrent loser"),
      reason: "Concurrent update two",
    },
    { role: "authenticated", schema: "public" },
  );
  requireOneConflict(editorialUpdates, "Only one concurrent editorial update succeeds");
  const publishedBeforeRace = (
    await sql(`select status from private.challenge_versions where id=${quote(editorialVersion)};`)
  ).trim();
  assert.equal(publishedBeforeRace, "draft", "A concurrent edit leaves the draft unpublished");
  const editorialPublishUpdatedAt = (
    await sql(`select updated_at::text from private.challenge_versions where id=${quote(editorialVersion)};`)
  ).trim();
  const editorialPublications = await race(
    "superadmin",
    "superadmin",
    "publish_superadmin_flash",
    {
      idempotencyKey: "s11-concurrent-publish-one",
      challengeVersionId: editorialVersion,
      expectedUpdatedAt: editorialPublishUpdatedAt,
      reason: "Concurrent publication one",
    },
    {
      idempotencyKey: "s11-concurrent-publish-two",
      challengeVersionId: editorialVersion,
      expectedUpdatedAt: editorialPublishUpdatedAt,
      reason: "Concurrent publication two",
    },
    { role: "authenticated", schema: "public" },
  );
  requireOneConflict(editorialPublications, "Only one concurrent editorial publication succeeds");
  assert.equal(
    (await sql(`select count(*) from private.challenge_versions where id=${quote(editorialVersion)} and status='published';`)).trim(),
    "1",
    "Concurrent editorial publication leaves one published version",
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
