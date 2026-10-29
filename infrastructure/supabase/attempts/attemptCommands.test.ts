import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttemptCommandError,
  callAttemptCommand,
  SupabaseAttemptCommands,
} from "./attemptCommands";

const pgMocks = vi.hoisted(() => ({ Pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: pgMocks.Pool }));

const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");

describe("Supabase attempt database connection", () => {
  const client = { query: vi.fn(), release: vi.fn() };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  const configuredUrl =
    "postgresql://postgres.bebmthwwyiyobaiertsm:p%40ssword@pooler.example:6543/postgres?sslmode=require";

  const startResult = {
    attemptId: "attempt",
    lockVersion: 1,
    sessionId: "session",
    resumed: false,
    controlRequired: false,
    deadlineAt: null,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
    process.env.SUPABASE_DB_URL = configuredUrl;
    pgMocks.Pool.mockImplementation(() => pool);
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("private.start_attempt")) return { rows: [{ result: startResult }] };
      return {};
    });
  });

  it("preserves the configured pooler URL and elevates only inside the transaction", async () => {
    await expect(
      callAttemptCommand({ authUserId: "00000000-0000-4000-8000-000000000001" }, "start_attempt", {
        scheduledChallengeId: "00000000-0000-4000-8000-000000000002" as never,
        idempotencyKey: "key",
        sessionToken: "token",
      }),
    ).resolves.toEqual(startResult);

    expect(pgMocks.Pool).toHaveBeenCalledWith({
      connectionString: configuredUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: "the-flash-game-web",
    });
    expect(client.query).toHaveBeenCalledWith("SET LOCAL ROLE service_role");
  });

  it.each(["28P01", "28000", "42501"])(
    "classifies PostgreSQL configuration error %s as database_unavailable",
    async (code) => {
      client.query.mockImplementation(async (query: string) => {
        if (query.includes("private.start_attempt")) {
          throw Object.assign(new Error("database configuration failure"), { code });
        }
        return {};
      });

      await expect(
        callAttemptCommand(
          { authUserId: "00000000-0000-4000-8000-000000000001" },
          "start_attempt",
          {
            scheduledChallengeId: "00000000-0000-4000-8000-000000000002" as never,
            idempotencyKey: "key",
            sessionToken: "token",
          },
        ),
      ).rejects.toMatchObject({
        code: "database_unavailable",
      } satisfies Partial<AttemptCommandError>);
    },
  );

  it("reconciles a stale attempt before accepting an action", async () => {
    const queries: string[] = [];
    client.query.mockImplementation(async (query: string) => {
      queries.push(query);
      if (query.includes("private.expire_stale_attempts")) {
        return { rows: [{ result: { abandonedAttempts: 1 } }] };
      }
      return {};
    });

    await expect(
      callAttemptCommand(
        { authUserId: "00000000-0000-4000-8000-000000000001" },
        "prepare_interaction",
        {
          attemptId: "00000000-0000-4000-8000-000000000003" as never,
          lockVersion: 1,
          sessionToken: "token",
          idempotencyKey: "key",
        },
      ),
    ).rejects.toMatchObject({ code: "attempt_inactivity_expired" });
    expect(queries.some((query) => query.includes("private.expire_stale_attempts"))).toBe(true);
    expect(queries.some((query) => query.includes("private.prepare_interaction"))).toBe(false);
  });

  const attemptId = "00000000-0000-4000-8000-000000000003";

  it("preserves the definitive late Alphabet pass error and rolls back", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("private.expire_stale_attempts"))
        return { rows: [{ result: { abandonedAttempts: 0 } }] };
      if (sql.includes("private.pass_interaction"))
        throw Object.assign(new Error("pass_unavailable"), { code: "55000" });
      return { rows: [] };
    });

    await expect(
      callAttemptCommand({ authUserId: attemptId }, "pass_interaction", {
        attemptId: attemptId as never,
        sessionToken: "session-token",
        lockVersion: 1,
        idempotencyKey: "alphabet-pass-1",
        challengeItemId: "00000000-0000-4000-8000-000000000004" as never,
      }),
    ).rejects.toMatchObject({ code: "pass_unavailable" });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it.each(["not_authorized", "session_revoked", "competitive_access_denied"])(
    "preserves domain denial %s even with PostgreSQL permission SQLSTATE",
    async (code) => {
      client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("private.start_attempt"))
          throw Object.assign(new Error(code), { code: "42501" });
        return {};
      });
      await expect(
        callAttemptCommand({ authUserId: attemptId }, "start_attempt", {
          scheduledChallengeId: "challenge" as never,
          sessionToken: "token",
          idempotencyKey: "key",
        }),
      ).rejects.toMatchObject({ code });
      expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    },
  );
  const context = {
    challengeMode: "alphabet",
    scheduledChallengeId: "00000000-0000-4000-8000-000000000002" as never,
  };
  const commands = new SupabaseAttemptCommands({
    authUserId: "00000000-0000-4000-8000-000000000001",
  });

  const prepared = {
    attemptId,
    lockVersion: 2,
    challengeItemId: "00000000-0000-4000-8000-000000000004" as never,
    questionType: "short-text",
    payloadSchemaVersion: 1,
    presentedAt: "2026-10-01T10:00:00Z",
    deadlineAt: "2026-10-01T10:01:00Z",
    timedOut: false,
    publicPayload: { question: "Conjunto de islas" },
    progress: {
      kind: "alphabet",
      round: 1,
      currentIndex: 0,
      playedCount: 1,
      correctAnswers: 0,
      incorrectAnswers: 0,
      elapsedTimeMs: 0,
      deadlineAt: "2026-10-01T10:01:00Z",
      lastCorrectAt: null,
      letters: [
        {
          letter: "A",
          challengeItemId: "00000000-0000-4000-8000-000000000004",
          status: "active",
          answer: null,
        },
      ],
    },
  };
  const itemContext = (value = prepared) => ({
    challengeItemId: value.challengeItemId,
    questionType: value.questionType,
    payloadSchemaVersion: value.payloadSchemaVersion,
    timeLimitMs: 60000,
    points: 10,
    mode: value.questionType === "short-text" ? "alphabet" : "flash",
    globalTimeLimitMs: 60000,
    publicPayload: value.publicPayload ?? {},
  });
  const prepareInput = {
    attemptId: attemptId as never,
    sessionToken: "session-token",
    lockVersion: 1,
    idempotencyKey: "alphabet-prepare-1",
  };

  it("derives only the public length in the existing transaction, including retries", async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: [
        {
          result: sql.includes("private.prepare_interaction") ? prepared : { abandonedAttempts: 0 },
          ...(sql.includes("as context") ? { context: itemContext() } : {}),
          ...(sql.includes("private.read_alphabet_answer_hint_source")
            ? { principal_answer: "archipiélago" }
            : {}),
        },
      ],
    }));
    const first = await commands.prepare(prepareInput);
    expect(first).toEqual({ ...prepared, answerLength: 12 });
    expect(JSON.stringify(first)).not.toContain("archipiélago");
    expect(first.publicPayload).toEqual(prepared.publicPayload);
    expect(client.query.mock.calls.filter(([sql]) => sql === "BEGIN")).toHaveLength(1);
    expect(
      client.query.mock.calls.filter(([sql]) => sql.includes("read_alphabet_answer_hint_source")),
    ).toHaveLength(1);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(await commands.prepare(prepareInput)).toEqual(first);
  });

  it.each([
    { ...prepared, publicPayload: null, timedOut: true },
    { ...prepared, progress: undefined },
    { ...prepared, progress: { kind: "flash" } },
    {
      ...prepared,
      questionType: "multiple-choice",
      publicPayload: { question: "Elige", options: ["A", "B"] },
    },
  ])("does not read principal answers outside a live Alphabet payload %#", async (value) => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: [
        {
          result: sql.includes("private.prepare_interaction") ? value : { abandonedAttempts: 0 },
          ...(sql.includes("as context") ? { context: itemContext(value as typeof prepared) } : {}),
        },
      ],
    }));
    expect(await commands.prepare(prepareInput)).toEqual(value);
    expect(
      client.query.mock.calls.some(([sql]) => sql.includes("read_alphabet_answer_hint_source")),
    ).toBe(false);
  });

  it("rolls back when the private hint read denies authorization", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("private.read_alphabet_answer_hint_source"))
        throw new Error("not_authorized");
      return {
        rows: [
          {
            ...(sql.includes("as context") ? { context: itemContext() } : {}),
            result: sql.includes("private.prepare_interaction")
              ? prepared
              : { abandonedAttempts: 0 },
          },
        ],
      };
    });
    await expect(commands.prepare(prepareInput)).rejects.toMatchObject({ code: "not_authorized" });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("reads only authorized metadata after claims and expiry, then commits and releases", async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("private.read_attempt_context")
        ? [{ read_attempt_context: context }]
        : [{ result: { abandonedAttempts: 0 } }],
    }));
    await expect(commands.readAttemptContext(attemptId, "session-token")).resolves.toEqual(context);
    const calls = client.query.mock.calls;
    expect(calls[0]?.[0]).toBe("BEGIN");
    expect(calls.findIndex(([sql]) => sql.includes("request.jwt.claims"))).toBeLessThan(
      calls.findIndex(([sql]) => sql.includes("expire_stale_attempts")),
    );
    expect(client.query).toHaveBeenCalledWith(
      "select private.read_attempt_context($1::uuid, $2::text)",
      [attemptId, "session-token"],
    );
    expect(calls.some(([sql]) => sql.includes("read_attempt_recovery"))).toBe(false);
    expect(calls.at(-1)?.[0]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { ...context, challengeMode: "unknown" },
    { ...context, challengeMode: ["flash"] },
    { ...context, scheduledChallengeId: "bad" },
    { ...context, answers: [] },
  ])("rolls back malformed context %#", async (value) => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("private.read_attempt_context")
        ? [{ read_attempt_context: value }]
        : [{ result: { abandonedAttempts: 0 } }],
    }));
    await expect(commands.readAttemptContext(attemptId, "session-token")).rejects.toMatchObject({
      code: "invalid_attempt_context",
    });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not read metadata when pre-expiry rejects the operation", async () => {
    client.query.mockResolvedValue({ rows: [{ result: { abandonedAttempts: 1 } }] });
    await expect(commands.readAttemptContext(attemptId, "session-token")).rejects.toMatchObject({
      code: "attempt_inactivity_expired",
    });
    expect(client.query.mock.calls.some(([sql]) => sql.includes("read_attempt_context"))).toBe(
      false,
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("uses the existing error translation on SQL failure", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("private.read_attempt_context")) throw new Error("session_revoked");
      return { rows: [{ result: { abandonedAttempts: 0 } }] };
    });
    await expect(commands.readAttemptContext(attemptId, "session-token")).rejects.toMatchObject({
      code: "session_revoked",
    });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it.each([false, true])(
    "completes from SQL without querying or sending a total (pending=%s)",
    async (pending) => {
      const input = {
        attemptId: attemptId as never,
        lockVersion: 3,
        sessionToken: "token",
        idempotencyKey: "completion-key",
        ...(pending
          ? {
              pendingEvaluation: {
                receiptId: "00000000-0000-4000-8000-000000000004" as never,
                status: "correct" as const,
                points: 17,
              },
            }
          : {}),
      };
      const result = {
        attemptId,
        lockVersion: 4,
        challengeMode: "alphabet",
        status: "completed",
        outcome: null,
        score: 37,
        answers: [],
      };
      client.query.mockImplementation(async (sql: string) => ({
        rows: [
          { result: sql.includes("private.complete_attempt") ? result : { abandonedAttempts: 0 } },
        ],
      }));

      await expect(commands.completeFromPersistedAnswers(input)).resolves.toEqual(result);
      expect(client.query).toHaveBeenCalledWith(
        "select private.complete_attempt($1::jsonb) as result",
        [JSON.stringify(input)],
      );
      const queries = client.query.mock.calls.map(([sql]) => String(sql));
      expect(
        queries.some((sql) => sql.includes("sum(") || sql.includes("private.attempt_answers")),
      ).toBe(false);
      expect(queries.findIndex((sql) => sql.includes("request.jwt.claims"))).toBeLessThan(
        queries.findIndex((sql) => sql.includes("expire_stale_attempts")),
      );
      expect(queries.findIndex((sql) => sql.includes("expire_stale_attempts"))).toBeLessThan(
        queries.findIndex((sql) => sql.includes("private.complete_attempt")),
      );
      expect(client.query).toHaveBeenLastCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledOnce();
    },
  );

  it("refreshes the Time Trial clock inside the completion transaction", async () => {
    const result = {
      attemptId,
      lockVersion: 4,
      challengeMode: "time-trial",
      status: "completed",
      outcome: null,
      score: 30,
      timeTrial: {
        kind: "time-trial",
        currentIndex: 1,
        solvedCount: 2,
        totalCount: 2,
        points: 30,
        elapsedTimeMs: 2000,
        clockStartedAt: "2026-10-01T10:00:00Z",
        deadlineAt: "2026-10-01T10:01:00Z",
        serverNow: "2026-10-01T10:00:02Z",
        lastCorrectElapsedMs: 2000,
        endReason: "all_solved",
      },
    };
    client.query.mockImplementation(async (sql: string) => ({
      rows: [
        sql.includes("clock_timestamp()")
          ? { server_now: "2026-10-01T10:00:03Z" }
          : {
              result: sql.includes("private.complete_attempt") ? result : { abandonedAttempts: 0 },
            },
      ],
    }));
    await expect(
      commands.completeFromPersistedAnswers({
        attemptId: attemptId as never,
        lockVersion: 3,
        sessionToken: "token",
        idempotencyKey: "key",
      }),
    ).resolves.toEqual({
      ...result,
      timeTrial: { ...result.timeTrial, serverNow: "2026-10-01T10:00:03Z" },
    });
    expect(client.query).toHaveBeenCalledWith("select clock_timestamp()::text as server_now");
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("commits pre-expiry without invoking completion", async () => {
    client.query.mockResolvedValue({ rows: [{ result: { abandonedAttempts: 1 } }] });
    await expect(
      commands.completeFromPersistedAnswers({
        attemptId: attemptId as never,
        lockVersion: 3,
        sessionToken: "token",
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "attempt_inactivity_expired" });
    expect(client.query.mock.calls.some(([sql]) => sql.includes("private.complete_attempt"))).toBe(
      false,
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    "attempts_outcome_values_check",
    "attempts_outcome_status_check",
    "attempts_status_check",
  ])("maps SQL contract constraint %s to an internal lifecycle error", async (constraint) => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("private.complete_attempt"))
        throw Object.assign(new Error("check constraint violation"), { code: "23514", constraint });
      return { rows: [{ result: { abandonedAttempts: 0 } }] };
    });
    await expect(
      commands.completeFromPersistedAnswers({
        attemptId: attemptId as never,
        lockVersion: 3,
        sessionToken: "token",
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "invalid_attempt_lifecycle" });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("rolls back a malformed authoritative completion with the lifecycle code", async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: [
        {
          result: sql.includes("private.complete_attempt")
            ? {
                attemptId,
                lockVersion: 4,
                challengeMode: "survival",
                status: "completed",
                outcome: "failed",
                score: 0,
              }
            : { abandonedAttempts: 0 },
        },
      ],
    }));
    await expect(
      commands.completeFromPersistedAnswers({
        attemptId: attemptId as never,
        lockVersion: 3,
        sessionToken: "token",
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "invalid_attempt_lifecycle" });
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("sends takeover through the same transactional command boundary", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("private.take_over_attempt")) {
        return {
          rows: [
            {
              result: {
                attemptId,
                sessionId: "00000000-0000-4000-8000-000000000004",
                lockVersion: 8,
                deadlineAt: null,
                transferred: true,
              },
            },
          ],
        };
      }
      return { rows: [{ result: { abandonedAttempts: 0 } }] };
    });

    await expect(
      commands.takeOver({
        attemptId: attemptId as never,
        scheduledChallengeId: "00000000-0000-4000-8000-000000000003" as never,
        lockVersion: 7,
        idempotencyKey: "takeover:key",
        newSessionToken: "candidate-token",
      }),
    ).resolves.toMatchObject({ attemptId, lockVersion: 8, transferred: true });
    expect(client.query).toHaveBeenCalledWith(
      "select private.take_over_attempt($1::jsonb) as result",
      [
        JSON.stringify({
          attemptId,
          scheduledChallengeId: "00000000-0000-4000-8000-000000000003",
          lockVersion: 7,
          idempotencyKey: "takeover:key",
          newSessionToken: "candidate-token",
        }),
      ],
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });
});

describe("authorized read identity contract", () => {
  const requested = "requested";
  const query = vi.fn();
  const release = vi.fn();
  const identity = { authUserId: "actor" };
  const commands = new SupabaseAttemptCommands(identity);
  it.each(["readCompletedAttempt", "readAbandonedAttempt", "readRecovery"] as const)(
    "rejects a mismatched identity in %s before committing",
    async (method) => {
      (globalThis as Record<PropertyKey, unknown>)[poolKey] = {
        connect: async () => ({ query, release }),
      };
      const result = {
        attemptId: "other",
        lockVersion: 3,
        challengeMode: "flash",
        status:
          method === "readAbandonedAttempt"
            ? "abandoned"
            : method === "readRecovery"
              ? "in_progress"
              : "completed",
        outcome: null,
        score: method === "readAbandonedAttempt" ? null : 10,
        answers: [],
        scheduledChallengeId: "challenge",
        hasStartedInteraction: true,
        allItemsResolved: false,
      };
      query.mockImplementation(async (sql: string) => ({
        rows: [
          {
            result: sql.includes("expire_stale_attempts")
              ? { abandonedAttempts: 0 }
              : { scheduledChallengeId: "challenge", result },
            read_attempt_recovery: result,
          },
        ],
      }));
      try {
        await expect(
          method === "readRecovery"
            ? commands.readRecovery(requested, "session")
            : commands[method](requested),
        ).rejects.toMatchObject({
          code: "invalid_backend_response",
          cause: { path: "response.attemptId" },
        });
        expect(query).toHaveBeenLastCalledWith("ROLLBACK");
      } finally {
        (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
      }
    },
  );
});
