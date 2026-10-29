import { readTimeTrialProgress } from "@/lib/timeTrial";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSessionProvider } from "@/application/ports/game-session";
import type { CompetitiveChallenge, ServerFlashChallenge } from "@/types/gameplay/challenge";
import type { GameSessionCommand } from "@/types/contracts/game-session";
import { CompetitiveSessionEngine } from "../competitive/core/sessionEngine";
import { createCompetitiveAttemptClient } from "../competitive/attemptClient";
import { createRemoteGameSessionProvider } from "./providers/remote";
import { createLocalFlashSessionProvider } from "./providers/localFlash";
import { createLocalTimeTrialSessionProvider } from "./providers/localTimeTrial";
import { createSessionResultDecoder, sessionValidationContext } from "./sessionResult";
import { compileDefinition, compileTimeTrialDefinition } from "./providers/localShared/definition";
import { formatProgress, initialFormatState } from "./providers/localShared/formats";
import {
  correctActions,
  definitionFor,
  sessionCases,
} from "@/test-utils/game-session-conformance/corpus";
import { SessionDriver, manualClock } from "@/test-utils/game-session-conformance/driver";
import { createTimeTrialTestDefinition } from "@/test-utils/game-session-conformance/timeTrialDefinition";

const at = "2026-10-01T10:00:00.000Z";
const engines: CompetitiveSessionEngine[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at);
});
afterEach(() => {
  engines.splice(0).forEach((e) => e.dispose());
  vi.useRealTimers();
});
function engineFor(provider: GameSessionProvider, challenge: CompetitiveChallenge) {
  const engine = new CompetitiveSessionEngine({
    provider,
    challenge,
    initialSession: { status: "new", results: [], score: 0 },
  });
  engines.push(engine);
  return engine;
}

/** Corrupt an acknowledgement after the real local authority has committed and cached it. */
function corruptOnce(
  provider: GameSessionProvider,
  challenge: CompetitiveChallenge,
  operation: "wordHashtagSwap" | "prepare" | "queensDraft" | "answer",
  patch: Record<string, unknown>,
  seen: GameSessionCommand[],
): GameSessionProvider {
  const decode = createSessionResultDecoder(sessionValidationContext(challenge));
  let corrupt = true;
  return {
    async execute(command, options) {
      if (command.operation === operation) seen.push(structuredClone(command));
      const result = await provider.execute(command, options);
      if (result.kind === "accepted" && command.operation === operation && corrupt) {
        corrupt = false;
        return decode(command, { ...result, state: { ...result.state, ...patch } });
      }
      return decode(command, result);
    },
  };
}

describe("Hashtag confirmation and identical recovery", () => {
  const original = definitionFor(sessionCases.find((v) => v.document.type === "word-hashtag")!);
  const challenge: ServerFlashChallenge = {
    ...original.challenge,
    mode: "flash",
    slots: original.challenge.levels,
  };
  const level = compileDefinition(original).levels[0]!;
  const action = correctActions(level.question)[0]!;
  if (action.operation !== "wordHashtagSwap") throw new Error("expected_swap");
  const progress = formatProgress(level, initialFormatState(level)) as {
    letters: (string | null)[];
  };
  const letters = [...progress.letters];
  [letters[action.input.fromCell], letters[action.input.toCell]] = [
    letters[action.input.toCell]!,
    letters[action.input.fromCell]!,
  ];

  it.each([
    ["remote", "empty-board"],
    ["local", "empty-board"],
    ["remote", "zero-moves"],
    ["local", "zero-moves"],
  ] as const)(
    "%s keeps a %s acknowledgement pending and replays it once",
    async (authority, fault) => {
      const seen: GameSessionCommand[] = [];
      let provider: GameSessionProvider;
      if (authority === "local") {
        provider = corruptOnce(
          createLocalFlashSessionProvider({ definition: { challenge, levels: original.levels } }),
          challenge,
          "wordHashtagSwap",
          fault === "empty-board"
            ? { letters: [] }
            : {
                movesUsed: 0,
                movesRemaining: Number(level.publicPayload.maxMoves),
              },
          seen,
        );
      } else {
        const client = createCompetitiveAttemptClient();
        client.prepareSession = vi.fn(async () => ({ ready: true }));
        client.start = vi.fn(async () => ({
          attemptId: "attempt",
          lockVersion: 1,
          resumed: false,
          deadlineAt: null,
        }));
        client.prepare = vi.fn(async () => ({
          attemptId: "attempt",
          lockVersion: 2,
          challengeItemId: level.source.challengeItemId,
          publicPayload: level.publicPayload,
          progress: formatProgress(level, initialFormatState(level)),
          presentedAt: at,
          deadlineAt: "2026-10-01T10:01:00Z",
          timedOut: false,
        }));
        let first = true;
        client.wordHashtagSwap = vi.fn(async () => {
          const response = {
            attemptId: "attempt",
            lockVersion: 3,
            challengeItemId: level.source.challengeItemId,
            letters: first && fault === "empty-board" ? [] : letters,
            correctCells: [],
            movesUsed: first && fault === "zero-moves" ? 0 : 1,
            movesRemaining:
              Number(level.publicPayload.maxMoves) - (first && fault === "zero-moves" ? 0 : 1),
            terminal: false,
          };
          first = false;
          return response;
        });
        const remote = createRemoteGameSessionProvider({
          client,
          context: sessionValidationContext(challenge),
        });
        provider = {
          async execute(command, options) {
            if (command.operation === "wordHashtagSwap") seen.push(structuredClone(command));
            return remote.execute(command, options);
          },
        };
      }
      const engine = engineFor(provider, challenge);
      await engine.lifecycle.begin();
      await engine.startQuestions();
      const before = structuredClone(engine.getSnapshot().question);
      await engine.interactions.submitWordHashtagSwap(action.input.fromCell, action.input.toCell);
      const pending = structuredClone(engine.getSnapshot().pendingCommand);
      expect(engine.getSnapshot()).toMatchObject({
        locked: true,
        attempt: { revision: 2 },
        results: [],
        question: before,
      });
      expect(pending).toMatchObject({
        operation: "wordHashtagSwap",
        input: { revision: 2, ...action.input },
      });
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen).toHaveLength(2);
      expect(seen[1]).toEqual(seen[0]);
      expect(engine.getSnapshot()).toMatchObject({
        pendingCommand: null,
        attempt: { revision: 3 },
        question: { progress: { letters, movesUsed: 1, swaps: [action.input] } },
      });
      await engine.retry();
      expect(seen).toHaveLength(2);
    },
  );
});

describe("Time Trial requires an authoritative clock before playing", () => {
  const definition = createTimeTrialTestDefinition();
  const { challenge } = definition;
  const level = compileTimeTrialDefinition(definition).levels[0]!;
  const waiting = {
    kind: "time-trial",
    currentIndex: 0,
    solvedCount: 0,
    totalCount: challenge.slots.length,
    points: 0,
    elapsedTimeMs: 0,
    clockStartedAt: null,
    deadlineAt: null,
    serverNow: at,
    lastCorrectElapsedMs: null,
    endReason: null,
  };
  const deadline = new Date(Date.parse(at) + challenge.timeLimitMs).toISOString();
  const active = { ...waiting, clockStartedAt: at, deadlineAt: deadline };
  it.each([
    ["remote", "queensDraft"],
    ["local", "queensDraft"],
    ["remote", "answer"],
    ["local", "answer"],
  ] as const)(
    "%s preserves the active clock and command after a regressive %s acknowledgement",
    async (authority, operation) => {
      const fixture = createTimeTrialTestDefinition({
        format: operation === "answer" ? "connect-pairs" : "queens",
      });
      const item = compileTimeTrialDefinition(fixture).levels[0]!;
      const seen: GameSessionCommand[] = [];
      let provider: GameSessionProvider;
      if (authority === "local") {
        provider = corruptOnce(
          createLocalTimeTrialSessionProvider({ definition: fixture }),
          fixture.challenge,
          operation,
          { timeTrial: readTimeTrialProgress(waiting) },
          seen,
        );
      } else {
        const client = createCompetitiveAttemptClient();
        client.prepareSession = vi.fn(async () => ({ ready: true }));
        client.start = vi.fn(async () => ({
          attemptId: "attempt",
          lockVersion: 1,
          resumed: false,
          deadlineAt: null,
        }));
        client.prepare = vi.fn(async () => ({
          attemptId: "attempt",
          lockVersion: 2,
          challengeItemId: item.source.challengeItemId,
          publicPayload: item.publicPayload,
          progress: formatProgress(item, initialFormatState(item)),
          presentedAt: at,
          deadlineAt: deadline,
          timedOut: false,
          timeTrial: active,
        }));
        let first = true;
        client[operation] = vi.fn(async () => {
          const result =
            operation === "answer"
              ? {
                  attemptId: "attempt",
                  lockVersion: 4,
                  challengeItemId: item.source.challengeItemId,
                  status: "correct",
                  points: fixture.challenge.slots[0]!.points,
                  timeUsedMs: 1000,
                  timedOut: false,
                }
              : {
                  ...(formatProgress(item, initialFormatState(item)) as Record<string, unknown>),
                  attemptId: "attempt",
                  lockVersion: 3,
                  challengeItemId: item.source.challengeItemId,
                };
          const response = first ? { ...result, timeTrial: waiting } : result;
          first = false;
          return response;
        });
        const remote = createRemoteGameSessionProvider({
          client,
          context: sessionValidationContext(fixture.challenge),
        });
        provider = {
          async execute(command, options) {
            if (command.operation === operation) seen.push(structuredClone(command));
            return remote.execute(command, options);
          },
        };
      }
      const engine = engineFor(provider, fixture.challenge);
      await engine.lifecycle.begin();
      await engine.lifecycle.startTimeTrial();
      const before = structuredClone(engine.getSnapshot());
      if (operation === "queensDraft") {
        if (before.question?.type !== "queens") throw new Error("expected_queens");
        engine.interactions.updateQueensDraft(before.question.progress.queens);
        await vi.advanceTimersByTimeAsync(300);
      } else {
        if (item.source.solution.type !== "connect-pairs") throw new Error("expected_paths");
        await engine.interactions.submit({
          paths: Object.fromEntries(
            Object.entries(item.source.solution.payload.paths).map(([id, path]) => [id, [...path]]),
          ),
        });
      }
      expect(engine.getSnapshot()).toMatchObject({
        pendingCommand: { operation },
        locked: true,
        deadlineAt: before.deadlineAt,
        timeTrial: before.timeTrial,
        question: before.question,
        attempt: before.attempt,
        results: [],
      });
      expect(
        engine.getSnapshot().lifecycleError?.code ?? engine.getSnapshot().feedback?.state,
      ).toBeDefined();
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen).toHaveLength(2);
      expect(seen[1]).toEqual(seen[0]);
      expect(engine.getSnapshot()).toMatchObject({
        pendingCommand: null,
        deadlineAt: before.deadlineAt,
        timeTrial: { clockStartedAt: active.clockStartedAt, deadlineAt: active.deadlineAt },
      });
      if (operation === "answer") expect(engine.getSnapshot().results).toHaveLength(1);
      else expect(engine.getSnapshot().phase).toBe("playing");
      await engine.retry();
      expect(seen).toHaveLength(2);
    },
  );
  it("replays the local authority's cached start without changing its stored acknowledgement", async () => {
    const provider = createLocalTimeTrialSessionProvider({ definition });
    const driver = new SessionDriver(
      provider,
      challenge.id,
      challenge.slots.map((slot) => slot.id),
    );
    await driver.issue("prepareSession");
    const command = driver.command("start");
    const original = await driver.execute(command);
    expect(original).toMatchObject({
      kind: "accepted",
      state: { timeTrial: { clockStartedAt: null, deadlineAt: null } },
    });
    const snapshot = JSON.stringify(original);
    await driver.issue("prepare");
    const replay = await provider.execute(command);
    expect(replay).toMatchObject({ kind: "accepted", operation: "start" });
    if (replay.kind !== "accepted") throw new Error(replay.code);
    expect(replay.state).not.toHaveProperty("timeTrial");
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(await driver.issue("queensDraft", { queens: [] })).toMatchObject({
      kind: "accepted",
      state: {
        timeTrial: { clockStartedAt: at, deadlineAt: deadline },
      },
    });
  });
  it("rejects a shifted but individually valid replay clock without replacing the accepted clock", async () => {
    const driver = new SessionDriver(
      createLocalTimeTrialSessionProvider({ definition }),
      challenge.id,
      challenge.slots.map((slot) => slot.id),
    );
    await driver.begin();
    const command = driver.command("prepare");
    const result = await driver.execute(command);
    if (result.kind !== "accepted" || !result.state.timeTrial) throw new Error("expected_clock");
    const decode = createSessionResultDecoder(sessionValidationContext(challenge));
    expect(decode(command, result)).toMatchObject({ kind: "accepted" });
    const shifted = readTimeTrialProgress({
      ...result.state.timeTrial,
      clockStartedAt: new Date(Date.parse(at) + 1000).toISOString(),
      deadlineAt: new Date(Date.parse(deadline) + 1000).toISOString(),
    });
    expect(
      decode(command, {
        ...result,
        state: {
          ...result.state,
          presentedAt: shifted.clockStartedAt,
          deadlineAt: shifted.deadlineAt,
          timeTrial: shifted,
        },
      }),
    ).toMatchObject({ kind: "uncertain", code: "invalid_backend_response" });
    expect(
      decode(
        {
          operation: "recover",
          input: { sessionId: result.state.sessionId!, revision: result.state.revision! },
        },
        {
          kind: "accepted",
          effect: "acknowledged",
          state: {
            sessionId: result.state.sessionId!,
            revision: result.state.revision!,
            phase: "briefing",
            answers: [],
            timeTrial: readTimeTrialProgress(waiting),
          },
        },
      ),
    ).toMatchObject({ kind: "uncertain", code: "invalid_backend_response" });
    expect(decode(command, result)).toMatchObject({
      kind: "accepted",
      state: {
        timeTrial: { clockStartedAt: at, deadlineAt: deadline },
      },
    });
  });
  it("refreshes the reference at delivery after queue delay without moving the global deadline", async () => {
    const clock = manualClock(Date.parse(at));
    const driver = new SessionDriver(
      createLocalTimeTrialSessionProvider({ definition, clock }),
      challenge.id,
      challenge.slots.map((slot) => slot.id),
    );
    await driver.begin();
    const response = driver.execute(driver.command("prepare"));
    clock.advance(1000);
    const result = await response;
    expect(result).toMatchObject({
      kind: "accepted",
      state: {
        timeTrial: {
          clockStartedAt: at,
          deadlineAt: deadline,
          serverNow: new Date(clock.now()).toISOString(),
        },
      },
    });
  });
  it("keeps the installed clock when the existing generic evaluation envelope omits it", async () => {
    const fixture = createTimeTrialTestDefinition({ format: "connect-pairs" });
    const item = compileTimeTrialDefinition(fixture).levels[0]!;
    if (item.source.solution.type !== "connect-pairs") throw new Error("expected_connect_pairs");
    const client = createCompetitiveAttemptClient();
    client.prepareSession = vi.fn(async () => ({ ready: true }));
    client.start = vi.fn(async () => ({
      attemptId: "attempt",
      lockVersion: 1,
      resumed: false,
      deadlineAt: null,
    }));
    client.prepare = vi.fn(async () => ({
      attemptId: "attempt",
      lockVersion: 2,
      challengeItemId: item.source.challengeItemId,
      publicPayload: item.publicPayload,
      presentedAt: at,
      deadlineAt: deadline,
      timedOut: false,
      timeTrial: active,
    }));
    client.answer = vi.fn(async () => ({
      attemptId: "attempt",
      lockVersion: 4,
      challengeItemId: item.source.challengeItemId,
      status: "correct",
      points: fixture.challenge.slots[0]!.points,
      timeUsedMs: 1000,
      timedOut: false,
    }));
    const engine = engineFor(
      createRemoteGameSessionProvider({
        client,
        context: sessionValidationContext(fixture.challenge),
      }),
      fixture.challenge,
    );
    await engine.lifecycle.begin();
    await engine.lifecycle.startTimeTrial();
    const before = structuredClone(engine.getSnapshot().timeTrial);
    await engine.interactions.submit({
      paths: Object.fromEntries(
        Object.entries(item.source.solution.payload.paths).map(([id, path]) => [id, [...path]]),
      ),
    });
    expect(client.answer).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "transition",
      pendingCommand: null,
      deadlineAt: Date.parse(deadline),
      timeTrial: before,
      attempt: { revision: 4 },
      results: [{ questionId: item.source.challengeItemId, status: "correct" }],
    });
  });
  it("permits real local abandonment before preparing the first board", async () => {
    const driver = new SessionDriver(
      createLocalTimeTrialSessionProvider({ definition }),
      challenge.id,
      challenge.slots.map((slot) => slot.id),
    );
    const start = await driver.begin();
    expect(start.state.timeTrial).toMatchObject({ clockStartedAt: null, deadlineAt: null });
    const result = await driver.issue("abandon");
    expect(result).toMatchObject({
      kind: "accepted",
      operation: "abandon",
      effect: "completed",
      state: {
        status: "abandoned",
        score: 0,
        timeTrial: { clockStartedAt: null, deadlineAt: null },
      },
    });
  });
  it.each(["remote", "local"])(
    "blocks an incomplete %s preparation and restores the same clock on replay",
    async (authority) => {
      const seen: GameSessionCommand[] = [];
      let provider: GameSessionProvider;
      if (authority === "local") {
        provider = corruptOnce(
          createLocalTimeTrialSessionProvider({ definition }),
          challenge,
          "prepare",
          { timeTrial: undefined },
          seen,
        );
      } else {
        const client = createCompetitiveAttemptClient();
        client.prepareSession = vi.fn(async () => ({ ready: true }));
        client.start = vi.fn(async () => ({
          attemptId: "attempt",
          lockVersion: 1,
          resumed: false,
          deadlineAt: null,
        }));
        let first = true;
        client.prepare = vi.fn(async () => {
          const response = {
            attemptId: "attempt",
            lockVersion: 2,
            challengeItemId: level.source.challengeItemId,
            publicPayload: level.publicPayload,
            progress: formatProgress(level, initialFormatState(level)),
            presentedAt: at,
            deadlineAt: deadline,
            timedOut: false,
            ...(first ? {} : { timeTrial: { ...active, serverNow: new Date().toISOString() } }),
          };
          first = false;
          return response;
        });
        const remote = createRemoteGameSessionProvider({
          client,
          context: sessionValidationContext(challenge),
        });
        provider = {
          async execute(command, options) {
            if (command.operation === "prepare") seen.push(structuredClone(command));
            return remote.execute(command, options);
          },
        };
      }
      const engine = engineFor(provider, challenge);
      await engine.lifecycle.begin();
      await engine.lifecycle.startTimeTrial();
      expect(engine.getSnapshot()).toMatchObject({
        locked: true,
        deadlineAt: null,
        pendingCommand: { operation: "prepare" },
        timeTrial: authority === "local" ? { clockStartedAt: null, deadlineAt: null } : null,
      });
      expect(engine.getSnapshot().phase).not.toBe("playing");
      await vi.advanceTimersByTimeAsync(1000);
      expect(seen).toHaveLength(2);
      expect(seen[1]).toEqual(seen[0]);
      expect(engine.getSnapshot()).toMatchObject({
        phase: "playing",
        pendingCommand: null,
        deadlineAt: Date.parse(deadline),
        timeTrial: { clockStartedAt: at, deadlineAt: deadline },
      });
    },
  );
});
