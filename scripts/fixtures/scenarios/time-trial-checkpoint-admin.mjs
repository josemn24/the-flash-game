import { sessionFixture } from "./competitive-session-fixture.mjs";
import { TABARNIA_QUEENS_TIME_TRIAL } from "./tabarnia-time-trial-queens.mjs";

const { challenge, questions } = TABARNIA_QUEENS_TIME_TRIAL;
const fixture = sessionFixture({
  id: "time-trial-checkpoint-admin",
  mode: "time-trial",
  title: challenge.title,
  globalTimeLimitMs: challenge.globalTimeLimitMs,
  modeConfig: { queensTimeoutPartialCredit: true },
  questions: questions.map((question, index) => ({
    ...question,
    points: challenge.items[index].points,
    solution: question.solutionPayload,
  })),
  additionalPlayers: ["jhon"],
});

const names = { alice: "Kike", bob: "Diego", carol: "Palmera", jhon: "Jhon3D", dave: "Operador" };
const lastCorrect = { alice: 100_724, bob: 99_083, carol: 112_982, jhon: 124_648 };
const kikeTimes = [8_894, 30_224, 41_556, 60_809, 82_443, 100_724, 150_000];

const checkpointAdminFixture = {
  ...fixture,
  users: fixture.users.map((user) => ({ ...user, displayName: names[user.label] })),
  buildDomainSql(input) {
    const { accounts, sqlString: quote, sqlUuid: uuid } = input;
    const clock = Date.UTC(2026, 10, 9, 23, 30, 38, 723);
    const at = (elapsed) => quote(new Date(clock + elapsed).toISOString());
    const json = (value) => quote(JSON.stringify(value));
    const version = uuid("challenge-version");
    const publication = uuid("publication");
    const statements = [
      "begin;",
      `insert into private.platform_role_assignments(player_id,role) values (${quote(accounts.dave.playerId)},'superadmin');`,
      // Seed immutable rows from the legacy outcome. This fixture runs only in a local test database.
      "set local session_replication_role = replica;",
      `update public.scheduled_challenges set number = 3, status = 'closed' where id = ${publication};`,
    ];
    const credits = [];
    for (const [player, finalTime] of Object.entries(lastCorrect)) {
      const legacy = player === "alice";
      const score = legacy ? 99 : 100;
      const attempt = uuid(`attempt-${player}`);
      const playerId = quote(accounts[player].playerId);
      const completed = legacy ? 151_103 : finalTime + 500;
      const times = legacy
        ? kikeTimes
        : questions.map((_, index) => Math.floor((finalTime * (index + 1)) / questions.length));
      statements.push(`
        insert into public.attempts (id, player_id, scheduled_challenge_id, challenge_version_id,
          kind, status, started_at, deadline_at, completed_at, score, client_state_schema_version, lock_version, terminal_reason)
        values (${attempt}, ${playerId}, ${publication}, ${version}, 'competitive', 'completed',
          ${at(-410)}, ${at(150_000)}, ${at(completed)}, ${score}, 1, 77, '${legacy ? "time_limit" : "all_solved"}');`);
      questions.forEach((question, index) => {
        const timedOut = legacy && index === questions.length - 1;
        const item = uuid(`item-${index}`);
        const receipt = uuid(`receipt-${player}-${index}`);
        const boardAnswer = timedOut
          ? "null"
          : json({ queens: question.solutionPayload.solution, marks: [] });
        const review = timedOut
          ? json({ type: "queens", queens: question.solutionPayload.solution })
          : "null";
        const effective = times[index];
        const presented = index === 0 ? 0 : times[index - 1] + 1_500;
        const points = challenge.items[index].points - (timedOut ? 1 : 0);
        statements.push(`
          insert into private.answer_receipts (id, attempt_id, challenge_item_id, challenge_version_id,
            answer, received_at, presented_at, effective_submitted_at, time_used_ms, timed_out)
          values (${receipt}, ${attempt}, ${item}, ${version}, ${boardAnswer}, ${at(timedOut ? completed : effective)},
            ${at(presented)}, ${at(effective)}, ${effective - presented}, ${timedOut});
          insert into private.attempt_answers (attempt_id, challenge_item_id, challenge_version_id, receipt_id,
            status, answer, review_state, points, presented_at, submitted_at, time_used_ms, idempotency_key)
          values (${attempt}, ${item}, ${version}, ${receipt}, '${timedOut ? "partial" : "correct"}', ${boardAnswer},
            ${review}, ${points}, ${at(presented)}, ${at(effective)}, ${effective - presented}, ${quote(`answer-${index}`)});`);
      });
      credits.push(`
        insert into private.flash_point_entries (season_id, player_id, scheduled_challenge_id, attempt_id,
          entry_type, amount, idempotency_key)
        values (${uuid("season")}, ${playerId}, ${publication}, ${attempt}, 'accreditation', ${score},
          ${quote(`accreditation-${player}`)});`);
    }
    statements.push(
      "set local session_replication_role = origin;",
      ...credits,
      `insert into private.audit_log (actor_player_id, action, entity_type, entity_id, after_payload, created_at)
       values (${quote(accounts.alice.playerId)}, 'save_queens_draft', 'attempt', ${uuid("attempt-alice")},
         '{"solved":true,"placedQueens":7}', ${at(149_932)});`,
      "commit;",
    );
    return fixture.buildDomainSql(input) + statements.join("\n");
  },
  manifest(input) {
    return {
      ...fixture.manifest(input),
      seasonId: input.stableId("season"),
      attemptId: input.stableId("attempt-alice"),
      lastBoardId: input.stableId("item-6"),
    };
  },
};

export default checkpointAdminFixture;
