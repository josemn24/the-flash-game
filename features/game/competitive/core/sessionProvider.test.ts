import { afterEach, expect, it, vi } from "vitest";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionResult } from "@/types/gameplay/authoritative-session";
import type { ServerFlashChallenge } from "@/types/gameplay/challenge";
import { CompetitiveSessionEngine } from "./sessionEngine";

const challenge: ServerFlashChallenge = {
  id: "challenge",
  definitionId: "definition",
  mode: "flash",
  number: 1,
  title: "Test",
  subtitle: "",
  description: "",
  maxScore: 10,
  slots: [
    {
      id: "item",
      position: 1,
      questionType: "multiple-choice",
      payloadSchemaVersion: 1,
      timeLimitMs: 60000,
      points: 10,
    },
  ],
};
const accepted = (
  state: Extract<GameSessionResult, { kind: "accepted" }>["state"],
): GameSessionResult => ({ kind: "accepted", effect: "acknowledged", state });
const engines: CompetitiveSessionEngine[] = [];
afterEach(() => engines.splice(0).forEach((engine) => engine.dispose()));

it("runs the current engine with an injected authority and clock, retaining an exact command for retry", async () => {
  let now = 1000000;
  let id = 0;
  const timers = new Map<number, () => void>();
  const clock: SessionClock = {
    now: () => now,
    setTimeout: (callback) => {
      timers.set(++id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (timer) => {
      timers.delete(timer as unknown as number);
    },
  };
  let attempts = 0;
  const execute = vi.fn<GameSessionProvider["execute"]>(async (command) => {
    switch (command.operation) {
      case "prepareSession":
        return accepted({ ready: true });
      case "start":
        return accepted({ sessionId: "injected-session", revision: 1 });
      case "prepare":
        return accepted({
          revision: 2,
          challengeItemId: "item",
          publicPayload: { question: "Elige", options: ["A", "B"] },
          presentedAt: new Date(now).toISOString(),
          deadlineAt: new Date(now + 60000).toISOString(),
        });
      case "answer":
        return attempts++ === 0
          ? {
              kind: "uncertain",
              code: "provider_unavailable",
              retryable: true,
              retryAfterSeconds: 4,
            }
          : {
              kind: "accepted",
              effect: "evaluated",
              state: { revision: 3, status: "correct", points: 10, timeUsedMs: 500 },
            };
      default:
        throw new Error(`unexpected ${command.operation}`);
    }
  });
  const engine = new CompetitiveSessionEngine({
    challenge,
    initialSession: { status: "new", results: [], score: 0 },
    provider: { execute },
    clock,
  });
  engines.push(engine);
  await engine.lifecycle.begin();
  await engine.startQuestions();
  await engine.interactions.submit("A");
  const pending = structuredClone(engine.getSnapshot().pendingCommand);
  expect(engine.getSnapshot().lifecycleError?.retryAt).toBe(1004000);
  now += 3999;
  await engine.retry();
  expect(attempts).toBe(1);
  now++;
  await engine.retry();
  expect(attempts).toBe(2);
  expect(
    execute.mock.calls
      .filter(([command]) => command.operation === "answer")
      .map(([command]) => command),
  ).toEqual([pending, pending]);
  expect(engine.getSnapshot()).toMatchObject({
    attempt: { id: "injected-session", revision: 3 },
    results: [{ points: 10 }],
    pendingCommand: null,
  });
  expect(timers.size).toBeGreaterThan(0);
  engine.dispose();
  expect(timers.size).toBe(0);
});

it("aborts the provider signal and ignores a late result after disposal", async () => {
  let finish!: (result: GameSessionResult) => void;
  let signal: AbortSignal | undefined;
  const provider: GameSessionProvider = {
    execute: (_command, options) => {
      signal = options?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const engine = new CompetitiveSessionEngine({
    challenge,
    initialSession: { status: "new", results: [], score: 0 },
    provider,
  });
  engines.push(engine);
  const pending = engine.lifecycle.begin();
  await Promise.resolve();
  const snapshot = engine.getSnapshot();
  engine.dispose();
  expect(signal?.aborted).toBe(true);
  finish(accepted({ ready: true }));
  await pending;
  expect(engine.getSnapshot()).toBe(snapshot);
});
