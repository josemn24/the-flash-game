import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseAttemptCommands } from "./attemptCommands";
import { sessionCases } from "@/test-utils/game-session-conformance/corpus";
const pg = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    connect = async () => pg;
  },
}));
const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");
const input = {
  attemptId: "attempt" as never,
  sessionToken: "private",
  lockVersion: 1,
  idempotencyKey: "same",
};
const image = sessionCases.find(
  (c) => c.document.type === "progressive-image" && c.document.payloadSchemaVersion === 2,
)!;
const publicPayload = { ...image.document.publicPayload, revealDurationMs: 70000 };
const prepared = {
  attemptId: "attempt",
  lockVersion: 2,
  challengeItemId: "item",
  questionType: "progressive-image",
  payloadSchemaVersion: 2,
  publicPayload,
  presentedAt: "2026-10-01T10:00:00Z",
  deadlineAt: "2026-10-01T10:01:30Z",
  timedOut: false,
};
const context = {
  challengeItemId: "item",
  questionType: "progressive-image",
  payloadSchemaVersion: 2,
  timeLimitMs: 90000,
  points: 14,
  mode: "flash",
  globalTimeLimitMs: null,
  publicPayload,
};
let itemContext: unknown;
let authorized: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  itemContext = context;
  authorized = true;
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  vi.stubEnv("SUPABASE_DB_URL", "postgresql://authenticator:postgres@127.0.0.1:54322/postgres");
  pg.query.mockImplementation(async (sql: string) => {
    if (sql.includes("expire_stale_attempts"))
      return { rows: [{ result: { abandonedAttempts: 0 } }] };
    if (sql.includes("private.prepare_interaction")) {
      if (!authorized) throw new Error("not_authorized");
      return { rows: [{ result: prepared }] };
    }
    if (sql.includes("as context")) return { rows: [{ context: itemContext }] };
    return { rows: [] };
  });
});
afterEach(() => {
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  vi.unstubAllEnvs();
});
const commands = () => new SupabaseAttemptCommands({ authUserId: "actor" });
describe("authorized preparation context and atomic validation", () => {
  it("reads the exact attempt version after authorization, before commit, without extending the response", async () => {
    expect(await commands().prepare(input)).toEqual(prepared);
    const calls = pg.query.mock.calls;
    const read = calls.findIndex(([sql]) => sql.includes("as context"));
    expect(read).toBeGreaterThan(
      calls.findIndex(([sql]) => sql.includes("private.prepare_interaction")),
    );
    expect(read).toBeLessThan(calls.findIndex(([sql]) => sql === "COMMIT"));
    expect(calls[read]![0]).toContain("i.challenge_version_id = cv.id");
    expect(calls[read]![0]).toContain("cv.id = a.challenge_version_id");
    expect(calls[read]![1]).toEqual(["attempt", "item"]);
    expect(pg.query).toHaveBeenLastCalledWith("COMMIT");
    expect(pg.release).toHaveBeenCalledOnce();
  });
  it.each([null, {}, { ...context, timeLimitMs: 30000 }, { ...context, challengeItemId: "other" }])(
    "rolls back invalid or inconsistent metadata %#",
    async (value) => {
      itemContext = value;
      await expect(commands().prepare(input)).rejects.toMatchObject({
        code: "invalid_backend_response",
      });
      expect(pg.query).toHaveBeenLastCalledWith("ROLLBACK");
      expect(pg.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
    },
  );
  it("does not read content when SQL denies authorization", async () => {
    authorized = false;
    await expect(commands().prepare(input)).rejects.toMatchObject({ code: "not_authorized" });
    expect(pg.query.mock.calls.some(([sql]) => sql.includes("as context"))).toBe(false);
    expect(pg.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
