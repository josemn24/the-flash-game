import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAttemptCommand } from "@/infrastructure/supabase/attempts/attemptCommands";
import { errorResponse } from "./attempt-api";
import { createRemoteGameSessionProvider } from "@/features/game/session/providers/remote";
import { CompetitiveSessionEngine } from "@/features/game/competitive/core/sessionEngine";
import { classifyCommandFailure } from "@/features/game/competitive/core/commandRecoveryPolicy";
import type { GameSessionFailure } from "@/types/contracts/game-session";
import type { ServerFlashChallenge, ServerPyramidChallenge } from "@/types/gameplay/challenge";
import * as presentation from "@/features/game/competitive/formats/failure";

const pg = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    connect = async () => pg;
  },
}));
const poolKey = Symbol.for("the-flash-game.supabase.attempt-pool");
const engines: CompetitiveSessionEngine[] = [];
const base: ServerFlashChallenge = {
  id: "challenge",
  definitionId: "definition",
  mode: "flash",
  number: 1,
  title: "Test",
  subtitle: "",
  description: "",
  maxScore: 20,
  slots: [1, 2].map((position) => ({
    id: `item-${position}`,
    position,
    questionType: "multiple-choice",
    payloadSchemaVersion: 1,
    timeLimitMs: 60000,
    points: 10,
  })),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  vi.stubEnv("SUPABASE_DB_URL", "postgresql://authenticator:postgres@127.0.0.1:54322/postgres");
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  pg.query.mockReset();
  pg.release.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  engines.splice(0).forEach((engine) => engine.dispose());
  (globalThis as Record<PropertyKey, unknown>)[poolKey] = undefined;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function databaseFailure(code: string, sqlstate = "55000", detail?: string) {
  const cause = Object.assign(new Error(code), { code: sqlstate, detail });
  pg.query.mockImplementation(async (sql: string) => {
    if (sql.includes("private.test_command")) throw cause;
    return { rows: [] };
  });
  try {
    await callAttemptCommand({ authUserId: "actor" }, "test_command", {});
    throw new Error("Expected database rejection");
  } catch (error) {
    return errorResponse(error, "contract-test", "test.error-contract");
  }
}

function setup(code: string, mode: "flash" | "survival" | "pyramid" = "flash") {
  const challenge =
    mode === "pyramid"
      ? ({
          ...base,
          mode,
          attemptVersion: 1,
          availableFrom: "2026-10-01T00:00:00Z",
          availableUntil: "2026-11-01T00:00:00Z",
          levels: base.slots.map((slot) => ({
            ...slot,
            levelId: slot.id,
            label: "Nivel",
            briefing: { title: "Nivel", format: "Test", description: "" },
          })),
        } satisfies ServerPyramidChallenge)
      : mode === "survival"
        ? { ...base, mode, lives: 3 }
        : base;
  let reject = true;
  const fetch = vi.fn(async (path: string) => {
    if ((path.endsWith("/complete") || path.endsWith("/answer")) && reject)
      return databaseFailure(code);
    if (path.endsWith("/session")) return Response.json({ ready: true });
    if (path.endsWith("/start")) return Response.json({ attemptId: "attempt", lockVersion: 1 });
    if (path.endsWith("/answer"))
      return Response.json({ lockVersion: 4, status: "correct", points: 10, timeUsedMs: 100 });
    return Response.json({
      lockVersion: path.endsWith("/activate") ? 3 : 2,
      challengeItemId: "item-1",
      publicPayload: { question: "Elige", options: ["A", "B"] },
      presentedAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 60000).toISOString(),
    });
  });
  vi.stubGlobal("fetch", fetch);
  const refresh = vi.fn();
  const engine = new CompetitiveSessionEngine({
    challenge,
    initialSession: { status: "new", results: [], score: 0 },
    provider: createRemoteGameSessionProvider(),
    refresh,
  });
  engines.push(engine);
  return {
    engine,
    fetch,
    refresh,
    accept: () => {
      reject = false;
    },
  };
}

describe("database to engine error contract", () => {
  it.each([undefined, "Un mensaje distinto"])(
    "presentation copy cannot change recovery (%s)",
    async (message) => {
      const { engine, fetch } = setup("request_predates_presentation");
      vi.spyOn(presentation, "formatFailure").mockReturnValue({
        message: message ?? "",
        feedback: undefined,
      });
      await engine.lifecycle.begin();
      await engine.startQuestions();
      const before = engine.getSnapshot();
      await engine.interactions.submit("A");
      expect(engine.getSnapshot()).toMatchObject({
        locked: false,
        pendingCommand: null,
        commandStatus: "definitive_failure",
        attempt: before.attempt,
        questionDeadlineAt: before.questionDeadlineAt,
      });
      const count = fetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetch).toHaveBeenCalledTimes(count);
    },
  );

  it("requires manual reload for an unknown 4xx rejection", async () => {
    const { engine, fetch, refresh } = setup("unused");
    fetch.mockImplementation(async () =>
      Response.json({ error: { code: "future_error" } }, { status: 422 }),
    );
    await engine.lifecycle.begin();
    expect(engine.getSnapshot()).toMatchObject({
      locked: true,
      pendingCommand: null,
      lifecycleError: { code: "unknown_rejection", recoveryAction: "refresh", retryable: false },
    });
    await vi.advanceTimersByTimeAsync(10000);
    await engine.retry(true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    await engine.retry();
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    "survival_not_terminal",
    "pyramid_not_terminal",
    "request_predates_presentation",
  ] as const)("preserves %s as a confirmed conflict through the real classifiers", async (code) => {
    const response = await databaseFailure(code);
    expect(response.status).toBe(409);
    expect(await response.clone().json()).toMatchObject({ error: { code } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const failure = await createRemoteGameSessionProvider().execute({
      operation: "complete",
      input: { sessionId: "attempt", revision: 2, idempotencyKey: "complete-key" },
    });
    expect(failure).toMatchObject({ code, kind: "rejected", retryable: false });
    const { action } = classifyCommandFailure({
      operation: code === "request_predates_presentation" ? "answer" : "complete",
      mode: "flash",
      failure: failure as GameSessionFailure,
      hasAttempt: true,
      terminalRecoveryAttempted: false,
      automaticRetries: 0,
      now: Date.now(),
    });
    expect(action).toMatchObject(
      code === "request_predates_presentation"
        ? {
            type: "command-failed",
            definitive: true,
            retry: { retryable: false, delayMs: undefined },
          }
        : { type: "reload-projection", automatic: false },
    );
    expect(pg.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it.each(["survival", "pyramid"] as const)(
    "requires manual reload after premature %s completion",
    async (mode) => {
      const { engine, fetch, refresh } = setup(`${mode}_not_terminal`, mode);
      await engine.lifecycle.begin();
      await engine.startQuestions();
      if (mode === "pyramid") await engine.lifecycle.activate();
      const before = engine.getSnapshot();
      // Both are queued before the first rejection reaches the engine.
      await Promise.all([engine.lifecycle.complete(), engine.lifecycle.prepare()]);
      expect(engine.getSnapshot()).toMatchObject({
        locked: true,
        pendingCommand: null,
        score: 0,
        results: [],
        lifecycleError: { operation: "projection", recoveryAction: "refresh", retryable: false },
      });
      expect(engine.getSnapshot().questionDeadlineAt).toBe(before.questionDeadlineAt);
      expect(refresh).not.toHaveBeenCalled();
      expect(fetch.mock.calls.filter(([path]) => path.endsWith("/prepare"))).toHaveLength(1);
      const count = fetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(120000);
      await engine.interactions.submit("A");
      await engine.lifecycle.complete();
      await engine.startQuestions();
      await engine.retry(true);
      expect(fetch).toHaveBeenCalledTimes(count);
      await engine.retry();
      expect(refresh).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledTimes(count);
    },
  );

  it("allows a new answer after a request predating presentation without recovery or extra time", async () => {
    const { engine, fetch, accept } = setup("request_predates_presentation");
    await engine.lifecycle.begin();
    await engine.startQuestions();
    const before = engine.getSnapshot();
    await engine.interactions.submit("A");
    expect(engine.getSnapshot()).toMatchObject({
      phase: "playing",
      locked: false,
      pendingCommand: null,
      commandStatus: "definitive_failure",
      attempt: before.attempt,
      questionDeadlineAt: before.questionDeadlineAt,
      results: [],
    });
    const count = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(count);
    accept();
    await engine.interactions.submit("B");
    const answers = fetch.mock.calls.filter(([path]) => path.endsWith("/answer"));
    expect(answers).toHaveLength(2);
    expect(engine.getSnapshot().results).toHaveLength(1);
  });

  it("does not recognize an identifier embedded in an unrelated database message", async () => {
    const response = await databaseFailure("unexpected stale_version diagnostic");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "command_failed" } });
  });

  it.each(['{"retryAfterSeconds":3}', '{"retryAfterSeconds":-1}', "invalid JSON"])(
    "keeps retry diagnostics in the database adapter (%s)",
    async (detail) => {
      const response = await databaseFailure("alphabet_deadline_not_reached", "55000", detail);
      expect(response.status).toBe(409);
      expect(response.headers.get("Retry-After")).toBe(detail.includes(":3") ? "3" : null);
    },
  );
});
