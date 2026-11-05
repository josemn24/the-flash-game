import { readTimeTrialProgress } from "@/lib/timeTrial";
import { createTimeTrialTestDefinition } from "@/test-utils/game-session-conformance/timeTrialDefinition";
import { compileTimeTrialDefinition } from "./providers/localShared/definition";
import { formatProgress, initialFormatState } from "./providers/localShared/formats";
import { describe, expect, it } from "vitest";
import { decodeSessionResult, createSessionResultDecoder } from "./sessionResult";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import type { SessionResultDraft } from "@/types/gameplay/authoritative-session";
import { definitionFor, sessionCases } from "@/test-utils/game-session-conformance/corpus";
import { createLocalPyramidSessionProvider } from "./providers/localPyramid";
import { SessionDriver, manualClock } from "@/test-utils/game-session-conformance/driver";
import { sessionValidationContext } from "./sessionResult";

const command: GameSessionCommand<"answer"> = {
  operation: "answer",
  input: {
    sessionId: "session",
    revision: 7,
    idempotencyKey: "same",
    challengeItemId: "item",
    answer: "A",
  },
};
const evaluated: SessionResultDraft = {
  kind: "accepted",
  effect: "evaluated",
  state: {
    sessionId: "session",
    revision: 7,
    challengeItemId: "item",
    status: "correct",
    points: 10,
    timeUsedMs: 1000,
  },
};
describe("shared local and remote result constructor", () => {
  it.each(["sessionId", "revision", "challengeItemId", "status", "points", "timeUsedMs"] as const)(
    "requires evaluated %s instead of manufacturing defaults",
    (key) => {
      const state = { ...evaluated.state };
      delete state[key];
      expect(decodeSessionResult(command, { ...evaluated, state })).toEqual({
        kind: "uncertain",
        code: "invalid_backend_response",
        retryable: true,
      });
      expect(command.input).toMatchObject({ revision: 7, idempotencyKey: "same", answer: "A" });
    },
  );
  it("permits identical replay revisions and ignores unrelated optional fields when deriving the effect", () => {
    expect(decodeSessionResult(command, evaluated)).toMatchObject({
      kind: "accepted",
      operation: "answer",
      state: { revision: 7 },
    });
    expect(
      decodeSessionResult(
        { operation: "start", input: { challengeId: "challenge", idempotencyKey: "key" } },
        {
          kind: "accepted",
          effect: "evaluated",
          state: {
            sessionId: "session",
            revision: 1,
            resumed: false,
            deadlineAt: null,
            terminal: true,
          },
        },
      ),
    ).toMatchObject({ kind: "uncertain" });
  });
  it("validates actual local acknowledgements and rejects the same missing fields at their shared boundary", async () => {
    const definition = definitionFor(sessionCases[0]!);
    const driver = new SessionDriver(
      createLocalPyramidSessionProvider({ definition, clock: manualClock() }),
      definition.challenge.id,
      definition.challenge.levels.map((i) => i.id),
    );
    await driver.begin();
    const prepare = driver.command("prepare");
    const result = await driver.execute(prepare);
    if (result.kind !== "accepted") throw new Error(result.code);
    const context = sessionValidationContext(definition.challenge);
    expect(result.operation).toBe("prepare");
    expect(decodeSessionResult(prepare, result, context)).toMatchObject({ kind: "accepted" });
    for (const field of [
      "publicPayload",
      "presentedAt",
      "deadlineAt",
      "challengeItemId",
    ] as const) {
      const state = { ...result.state };
      delete state[field];
      expect(decodeSessionResult(prepare, { ...result, state }, context)).toMatchObject({
        kind: "uncertain",
        code: "invalid_backend_response",
      });
    }
  });
});

describe("mode and operation clock requirements", () => {
  const context = {
    mode: "time-trial" as const,
    timeLimitMs: 120000,
    items: ["item", "next"].map((id) => ({
      id,
      questionType: "queens" as const,
      timeLimitMs: 1000,
      points: 50,
      payloadSchemaVersion: 1,
    })),
  };
  const waiting = {
    kind: "time-trial",
    currentIndex: 0,
    solvedCount: 0,
    totalCount: 2,
    points: 0,
    elapsedTimeMs: 0,
    clockStartedAt: null,
    deadlineAt: null,
    serverNow: "2026-10-01T10:00:00Z",
    lastCorrectElapsedMs: null,
    endReason: null,
  } as const;
  const active = {
    ...waiting,
    clockStartedAt: "2026-10-01T10:00:00Z",
    deadlineAt: "2026-10-01T10:02:00Z",
  };
  const identity = { sessionId: "session", revision: 7 };
  it("accepts the existing start envelope and validates a clock when present", () => {
    const start = {
      operation: "start",
      input: { challengeId: "challenge", idempotencyKey: "same" },
    } as const;
    const state = { ...identity, resumed: false, deadlineAt: null };
    expect(
      decodeSessionResult(start, { kind: "accepted", effect: "acknowledged", state }, context),
    ).toMatchObject({ kind: "accepted" });
    expect(
      decodeSessionResult(
        start,
        {
          kind: "accepted",
          effect: "acknowledged",
          state: { ...state, timeTrial: waiting as never },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
  });
  it("requires an active clock only when recovery resumes a playing board", () => {
    const recover = { operation: "recover", input: identity } as const;
    const state = { ...identity, phase: "briefing", answers: [], timeTrial: waiting as never };
    expect(
      decodeSessionResult(recover, { kind: "accepted", effect: "acknowledged", state }, context),
    ).toMatchObject({ kind: "accepted" });
    expect(
      decodeSessionResult(
        recover,
        { kind: "accepted", effect: "acknowledged", state: { ...state, phase: "playing" } },
        context,
      ),
    ).toMatchObject({ kind: "uncertain" });
    expect(
      decodeSessionResult(
        recover,
        {
          kind: "accepted",
          effect: "acknowledged",
          state: { ...state, phase: "playing", timeTrial: active as never },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
  });
  it("distinguishes regulatory completion from abandonment before the clock starts", () => {
    const complete = {
      operation: "complete",
      input: { ...identity, idempotencyKey: "same" },
    } as const;
    const state = { ...identity, phase: "results", score: 0, timeTrial: active as never };
    expect(
      decodeSessionResult(complete, { kind: "accepted", effect: "completed", state }, context),
    ).toMatchObject({ kind: "uncertain" });
    expect(
      decodeSessionResult(
        complete,
        {
          kind: "accepted",
          effect: "completed",
          state: { ...state, timeTrial: { ...active, endReason: "time_limit" } as never },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
    expect(
      decodeSessionResult(
        { operation: "abandon", input: identity },
        {
          kind: "accepted",
          effect: "completed",
          state: { ...identity, phase: "results", status: "abandoned", score: 0 },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
    expect(
      decodeSessionResult(
        { operation: "recover", input: identity },
        {
          kind: "accepted",
          effect: "completed",
          state: { ...identity, phase: "results", status: "abandoned", score: 0, answers: [] },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
    expect(
      decodeSessionResult(
        { operation: "abandon", input: identity },
        {
          kind: "accepted",
          effect: "completed",
          state: {
            ...state,
            status: "abandoned",
            timeTrial: waiting as never,
          },
        },
        context,
      ),
    ).toMatchObject({ kind: "accepted" });
  });
});

describe("clock ownership and non-regression", () => {
  const definition = createTimeTrialTestDefinition();
  const context = sessionValidationContext(definition.challenge);
  const level = compileTimeTrialDefinition(definition).levels[0]!;
  const waiting = readTimeTrialProgress({
    kind: "time-trial",
    currentIndex: 0,
    solvedCount: 0,
    totalCount: context.items.length,
    points: 0,
    elapsedTimeMs: 0,
    clockStartedAt: null,
    deadlineAt: null,
    serverNow: "2026-10-01T10:00:00.000Z",
    lastCorrectElapsedMs: null,
    endReason: null,
  });
  const active = readTimeTrialProgress({
    ...waiting,
    clockStartedAt: waiting.serverNow,
    deadlineAt: new Date(
      Date.parse(waiting.serverNow) + definition.challenge.timeLimitMs,
    ).toISOString(),
  });
  const identity = { sessionId: "session", revision: 2 };
  const prepare: GameSessionCommand<"prepare"> = {
    operation: "prepare",
    input: { ...identity, revision: 1, idempotencyKey: "prepare" },
  };
  const prepared: SessionResultDraft = {
    kind: "accepted",
    effect: "acknowledged",
    state: {
      ...identity,
      challengeItemId: level.source.challengeItemId,
      presentedAt: active.clockStartedAt,
      deadlineAt: active.deadlineAt,
      publicPayload: level.publicPayload,
      timedOut: false,
      progress: formatProgress(level, initialFormatState(level)),
      timeTrial: active,
    },
  };
  const draftCommand: GameSessionCommand<"queensDraft"> = {
    operation: "queensDraft",
    input: {
      ...identity,
      idempotencyKey: "draft",
      challengeItemId: level.source.challengeItemId,
      queens: [],
    },
  };
  const draftResult = (clock = active): SessionResultDraft => ({
    kind: "accepted",
    effect: "progress",
    state: {
      ...(formatProgress(level, initialFormatState(level)) as Record<string, unknown>),
      ...identity,
      revision: 3,
      challengeItemId: level.source.challengeItemId,
      timeTrial: clock,
    },
  });
  function withActiveClock() {
    const decode = createSessionResultDecoder(context);
    expect(decode(prepare, prepared)).toMatchObject({ kind: "accepted" });
    return decode;
  }
  it("projects readiness only and cannot learn a clock or replace a known session", () => {
    const decode = withActiveClock();
    const readiness: SessionResultDraft = {
      kind: "accepted",
      effect: "acknowledged",
      state: {
        ready: true,
        sessionId: "foreign",
        revision: 999,
        timeTrial: waiting,
        deadlineAt: null,
        score: 100,
        publicPayload: { ignored: true },
      },
    };
    expect(
      decode(
        { operation: "prepareSession", input: { challengeId: definition.challenge.id } },
        readiness,
      ),
    ).toEqual({
      kind: "accepted",
      operation: "prepareSession",
      effect: "acknowledged",
      state: { ready: true },
    });
    expect(decode(draftCommand, draftResult(waiting))).toMatchObject({
      kind: "uncertain",
      code: "invalid_backend_response",
    });
    expect(decode(draftCommand, draftResult())).toMatchObject({ kind: "accepted" });
    expect(readiness.state).toMatchObject({ sessionId: "foreign", timeTrial: waiting, score: 100 });
    const fresh = createSessionResultDecoder(context);
    fresh(
      { operation: "prepareSession", input: { challengeId: definition.challenge.id } },
      {
        ...readiness,
        state: { ...readiness.state, sessionId: identity.sessionId, timeTrial: active },
      },
    );
    expect(
      fresh(
        {
          operation: "start",
          input: { challengeId: definition.challenge.id, idempotencyKey: "start" },
        },
        {
          kind: "accepted",
          effect: "acknowledged",
          state: { ...identity, resumed: false, deadlineAt: null, timeTrial: waiting },
        },
      ),
    ).toMatchObject({ kind: "accepted", state: { timeTrial: waiting } });
  });
  it.each(["start", "takeover"] as const)(
    "accepts an old %s acknowledgement without publishing or mutating its unstarted clock",
    (operation) => {
      const decode = withActiveClock();
      const cached: SessionResultDraft = Object.freeze({
        kind: "accepted",
        effect: "acknowledged",
        state: Object.freeze({
          ...identity,
          revision: 1,
          resumed: false,
          deadlineAt: null,
          timeTrial: Object.freeze({ ...waiting }),
        }),
      });
      const before = JSON.stringify(cached);
      const command: GameSessionCommand =
        operation === "start"
          ? {
              operation,
              input: { challengeId: definition.challenge.id, idempotencyKey: "original-start" },
            }
          : {
              operation,
              input: {
                ...identity,
                challengeId: definition.challenge.id,
                idempotencyKey: "original-takeover",
              },
            };
      const accepted = decode(command, cached);
      expect(accepted).toMatchObject({
        kind: "accepted",
        operation,
        state: { ...identity, revision: 1, resumed: false, deadlineAt: null },
      });
      if (accepted.kind !== "accepted") throw new Error(accepted.code);
      expect(accepted.state).not.toHaveProperty("timeTrial");
      expect(JSON.stringify(cached)).toBe(before);
      expect(decode(draftCommand, draftResult(waiting))).toMatchObject({ kind: "uncertain" });
      expect(decode(draftCommand, draftResult())).toMatchObject({
        kind: "accepted",
        state: { timeTrial: active },
      });
    },
  );
  it("permits a waiting session before preparation and starts a separate clock for a new session", () => {
    const decode = withActiveClock();
    const start: GameSessionCommand<"start"> = {
      operation: "start",
      input: { challengeId: definition.challenge.id, idempotencyKey: "new-session" },
    };
    expect(
      decode(start, {
        kind: "accepted",
        effect: "acknowledged",
        state: {
          sessionId: "new-session",
          revision: 1,
          resumed: false,
          deadlineAt: null,
          timeTrial: waiting,
        },
      }),
    ).toMatchObject({ kind: "accepted", state: { timeTrial: waiting } });
    const later = readTimeTrialProgress({
      ...active,
      clockStartedAt: new Date(Date.parse(active.clockStartedAt!) + 5000).toISOString(),
      deadlineAt: new Date(Date.parse(active.deadlineAt!) + 5000).toISOString(),
    });
    expect(
      decode(
        { ...prepare, input: { ...prepare.input, sessionId: "new-session" } },
        {
          ...prepared,
          state: {
            ...prepared.state,
            sessionId: "new-session",
            presentedAt: later.clockStartedAt,
            deadlineAt: later.deadlineAt,
            timeTrial: later,
          },
        },
      ),
    ).toMatchObject({ kind: "accepted", state: { timeTrial: later } });
  });
  it.each(["abandon", "recover"] as const)(
    "retains terminal abandonment variants for %s",
    (operation) => {
      const decode = withActiveClock();
      for (const clock of [undefined, waiting])
        expect(
          decode(
            { operation, input: identity },
            {
              kind: "accepted",
              effect: "completed",
              state: {
                ...identity,
                phase: "results",
                status: "abandoned",
                score: 0,
                answers: [],
                timeTrial: clock,
              },
            },
          ),
        ).toMatchObject({ kind: "accepted", effect: "completed" });
    },
  );
});
