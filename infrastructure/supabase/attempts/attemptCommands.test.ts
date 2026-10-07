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

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
    process.env.SUPABASE_DB_URL = configuredUrl;
    pgMocks.Pool.mockImplementation(() => pool);
    client.query.mockImplementation(async (query: string) => {
      if (query.includes("private.start_attempt")) return { rows: [{ result: { ok: true } }] };
      return {};
    });
  });

  it("preserves the configured pooler URL and elevates only inside the transaction", async () => {
    await expect(
      callAttemptCommand({ authUserId: "00000000-0000-4000-8000-000000000001" }, "start_attempt", {
        scheduledChallengeId: "00000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({ ok: true });

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
            scheduledChallengeId: "00000000-0000-4000-8000-000000000002",
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
        { attemptId: "00000000-0000-4000-8000-000000000003" },
      ),
    ).rejects.toMatchObject({ code: "attempt_inactivity_expired" });
    expect(queries.some((query) => query.includes("private.expire_stale_attempts"))).toBe(true);
    expect(queries.some((query) => query.includes("private.prepare_interaction"))).toBe(false);
  });

  const attemptId = "00000000-0000-4000-8000-000000000003";
  it.each(["not_authorized", "session_revoked", "competitive_access_denied"])(
    "preserves domain denial %s even with PostgreSQL permission SQLSTATE",
    async (code) => {
      client.query.mockImplementation(async (sql: string) => {
        if (sql.includes("private.start_attempt"))
          throw Object.assign(new Error(code), { code: "42501" });
        return {};
      });
      await expect(
        callAttemptCommand({ authUserId: attemptId }, "start_attempt", {}),
      ).rejects.toMatchObject({ code });
      expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    },
  );
  const context = {
    challengeMode: "alphabet",
    scheduledChallengeId: "00000000-0000-4000-8000-000000000002",
  };
  const commands = new SupabaseAttemptCommands({
    authUserId: "00000000-0000-4000-8000-000000000001",
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
