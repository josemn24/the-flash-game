import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSessionProvider, SessionClock } from "@/application/ports/game-session";
import type { GameSessionCommand, GameSessionOperation } from "@/types/contracts/game-session";
import type { UtcIsoDateTime } from "@/types/domain/values";
import type { TimeTrialProgress } from "@/types/domain/time-trial";
import type {
  AuthoritativeSessionUpdate,
  GameSessionResult,
} from "@/types/gameplay/authoritative-session";
import type { CompetitiveChallenge } from "@/types/gameplay/challenge";
import { CompetitiveSessionEngine } from "./sessionEngine";

const accepted = (state: AuthoritativeSessionUpdate): GameSessionResult => ({
  kind: "accepted",
  effect: "acknowledged",
  state,
});
const uncertain: GameSessionResult = { kind: "uncertain", code: "offline", retryable: true };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function drain() {
  for (let i = 0; i < 60; i++) await Promise.resolve();
}
const engines: CompetitiveSessionEngine[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
});
afterEach(() => {
  engines.splice(0).forEach((engine) => engine.dispose());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup(mode: "flash" | "alphabet" | "time-trial" = "flash") {
  const base = {
    id: "challenge",
    definitionId: "definition",
    number: 1,
    title: "Test",
    subtitle: "",
    description: "",
    maxScore: 100,
  };
  const slot = {
    id: "a",
    position: 1,
    questionType: "multiple-choice" as const,
    payloadSchemaVersion: 1,
    timeLimitMs: 60000,
    points: 100,
  };
  const challenge: CompetitiveChallenge =
    mode === "alphabet"
      ? {
          ...base,
          mode,
          timeLimitMs: 60000,
          entries: [{ ...slot, questionType: "short-text", letter: "A" }],
        }
      : mode === "time-trial"
        ? { ...base, mode, timeLimitMs: 60000, slots: [{ ...slot, questionType: "queens" }] }
        : { ...base, mode, slots: [slot] };
  const deadline = new Date(Date.now() + 60000).toISOString() as UtcIsoDateTime;
  const progress: TimeTrialProgress = {
    kind: "time-trial",
    currentIndex: 0,
    solvedCount: 0,
    totalCount: 1,
    points: 0,
    elapsedTimeMs: 0,
    clockStartedAt: new Date().toISOString() as UtcIsoDateTime,
    deadlineAt: deadline,
    serverNow: new Date().toISOString() as UtcIsoDateTime,
    lastCorrectElapsedMs: null,
    endReason: null,
  };
  const prepared: AuthoritativeSessionUpdate = {
    revision: 2,
    challengeItemId: "a",
    presentedAt: new Date().toISOString(),
    deadlineAt: deadline,
    publicPayload:
      mode === "time-trial"
        ? {
            question: "Coronas",
            grid: { rows: 4, columns: 4 },
            regions: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 3, 3, 3, 2],
            prefilledQueens: [2],
          }
        : mode === "alphabet"
          ? { question: "Letra A" }
          : { question: "Elige", options: ["A", "B"] },
    ...(mode === "time-trial" ? { timeTrial: progress } : {}),
    ...(mode === "alphabet" ? { progress: { kind: "alphabet", letters: [], round: 1 } } : {}),
  };
  const commands: GameSessionCommand[] = [];
  const handlers: Partial<Record<GameSessionOperation, () => Promise<GameSessionResult>>> = {};
  const execute = vi.fn<GameSessionProvider["execute"]>(async (command) => {
    commands.push(structuredClone(command));
    const handler = handlers[command.operation];
    if (handler) return handler();
    switch (command.operation) {
      case "prepareSession":
        return accepted({ ready: true });
      case "start":
        return accepted({
          sessionId: "session",
          revision: 1,
          deadlineAt: deadline,
          ...(mode === "time-trial" ? { timeTrial: progress } : {}),
        });
      case "prepare":
        return accepted(prepared);
      case "answer":
        return accepted({ revision: 3, status: "correct", points: 100, timeUsedMs: 1000 });
      case "takeover":
        return accepted({ sessionId: "session", revision: 8 });
      case "recover":
        return accepted({ revision: 9, phase: "results", score: 100, answers: [] });
      case "complete":
        return accepted({ revision: 10, score: 100, answers: [] });
      case "abandon":
        return accepted({ status: "abandoned" });
      default:
        throw new Error(`Unexpected ${command.operation}`);
    }
  });
  const clock: SessionClock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  const engine = new CompetitiveSessionEngine({
    challenge,
    initialSession: { status: "new", score: 0, results: [] },
    provider: { execute },
    clock,
  });
  engines.push(engine);
  const play = async () => {
    await engine.lifecycle.begin();
    await engine.startQuestions();
  };
  const operations = () => commands.map((command) => command.operation);
  const transfer = async () => {
    handlers.start = async () => ({
      kind: "rejected",
      code: "attempt_control_required",
      retryable: false,
      controlRequired: { sessionId: "session", revision: 7, deadlineAt: deadline },
    });
    await play();
  };
  return { engine, handlers, commands, play, transfer, operations, prepared, progress, deadline };
}

describe("global closure command ordering", () => {
  it.each(["alphabet", "time-trial"] as const)(
    "%s closes an expired preparation once without preparing again",
    async (mode) => {
      const s = setup(mode);
      s.handlers.prepare = async () => accepted({ ...s.prepared, timedOut: true });
      await s.play();
      expect(s.operations()).toEqual(["prepareSession", "start", "prepare", "complete"]);
      await Promise.all([s.engine.interactions.onTimeUp(), s.engine.interactions.onTimeUp()]);
      expect(s.operations().filter((op) => op === "complete")).toHaveLength(1);
      expect(s.engine.getSnapshot()).toMatchObject({
        phase: "results",
        deadlineAt: Date.parse(s.deadline),
      });
    },
  );

  it("Contrarreloj waits for in-flight preparation before closing and rereads state after its callback", async () => {
    const s = setup("time-trial");
    const pending = deferred<GameSessionResult>();
    s.handlers.prepare = () => pending.promise;
    const playing = s.play();
    await drain();
    await s.engine.interactions.onTimeUp();
    expect(s.operations()).not.toContain("complete");
    pending.resolve(accepted(s.prepared));
    await playing;
    expect(s.operations()).toEqual(["prepareSession", "start", "prepare", "complete"]);
    expect(s.engine.getSnapshot().phase).toBe("results");
  });

  it.each(["deadline_reached", "time_trial_terminal"])(
    "Contrarreloj closes after %s rather than replaying preparation",
    async (code) => {
      const s = setup("time-trial");
      s.handlers.prepare = async () => ({ kind: "rejected", code, retryable: false });
      await s.play();
      expect(s.operations()).toEqual(["prepareSession", "start", "prepare", "complete"]);
    },
  );

  it.each(["deadline_reached", "time_trial_terminal"])(
    "Contrarreloj also closes when retrying preparation returns %s",
    async (code) => {
      const s = setup("time-trial");
      let attempts = 0;
      s.handlers.prepare = async () =>
        attempts++ === 0 ? uncertain : { kind: "rejected", code, retryable: false };
      await s.play();
      await s.engine.retry();
      expect(s.operations()).toEqual(["prepareSession", "start", "prepare", "prepare", "complete"]);
      expect(s.engine.getSnapshot().phase).toBe("results");
    },
  );

  it("Alfabeto closes an expired pass reported by a retry without executing its prepare callback", async () => {
    const s = setup("alphabet");
    let passes = 0;
    s.handlers.alphabetPass = async () =>
      passes++ === 0
        ? uncertain
        : {
            kind: "rejected",
            code: "pass_unavailable",
            retryable: false,
          };
    await s.play();
    await s.engine.interactions.pass();
    await s.engine.retry();
    expect(s.operations()).toEqual([
      "prepareSession",
      "start",
      "prepare",
      "alphabetPass",
      "alphabetPass",
      "complete",
    ]);
    expect(s.engine.getSnapshot()).toMatchObject({ phase: "results", lifecycleError: undefined });
  });

  it.each(["run", "retry"] as const)(
    "Alfabeto preserves its %s recovery path when an answer becomes uncertain during closing",
    async (origin) => {
      const s = setup("alphabet");
      const pending = deferred<GameSessionResult>();
      let answers = 0;
      s.handlers.answer = async () =>
        origin === "retry" && answers++ === 0 ? uncertain : pending.promise;
      await s.play();
      const submitting = s.engine.interactions.submit("A");
      await drain();
      let replay: Promise<void> | undefined;
      if (origin === "retry") {
        await submitting;
        replay = s.engine.retry();
        await drain();
      }
      await s.engine.interactions.onTimeUp();
      pending.resolve(uncertain);
      await (replay ?? submitting);
      expect(s.operations().includes("recover")).toBe(origin === "run");
      expect(s.engine.getSnapshot().phase).toBe(origin === "run" ? "results" : "finalizing");
    },
  );

  it.each(["alphabet", "time-trial"] as const)(
    "%s repeats a lost close at 1/2/4 seconds with the original command",
    async (mode) => {
      const s = setup(mode);
      s.handlers.complete = async () => uncertain;
      await s.play();
      await s.engine.interactions.onTimeUp();
      for (const delay of [1000, 2000, 4000]) await vi.advanceTimersByTimeAsync(delay);
      const closes = s.commands.filter((command) => command.operation === "complete");
      expect(closes).toHaveLength(4);
      expect(closes.every((command) => JSON.stringify(command) === JSON.stringify(closes[0]))).toBe(
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      expect(s.commands.filter((command) => command.operation === "complete")).toHaveLength(4);
      s.handlers.complete = async () => accepted({ revision: 11, score: 100 });
      await s.engine.retry();
      expect(s.engine.getSnapshot().phase).toBe("results");
    },
  );
});

describe("transfer recovery boundaries", () => {
  it.each(["flash", "alphabet", "time-trial"] as const)(
    "%s deduplicates transfer and replays a lost confirmation exactly before recovery",
    async (mode) => {
      const s = setup(mode);
      await s.transfer();
      const pending = deferred<GameSessionResult>();
      s.handlers.takeover = () => pending.promise;
      const transferring = s.engine.takeOver();
      await drain();
      await s.engine.takeOver();
      pending.resolve(uncertain);
      await transferring;
      expect(s.operations().filter((op) => op === "takeover")).toHaveLength(1);
      s.handlers.takeover = async () => accepted({ sessionId: "session", revision: 8 });
      await vi.advanceTimersByTimeAsync(1000);
      const transfers = s.commands.filter((command) => command.operation === "takeover");
      expect(transfers).toHaveLength(2);
      expect(transfers[1]).toEqual(transfers[0]);
      expect(s.operations().slice(-3)).toEqual(["takeover", "takeover", "recover"]);
      expect(s.engine.getSnapshot()).toMatchObject({
        phase: "results",
        attempt: { id: "session", revision: 9 },
      });
      expect(s.operations()).not.toContain("complete");
    },
  );

  it.each(["stale_version", "idempotency_conflict"])(
    "a %s transfer conflict is definitive and does not recover or retry",
    async (code) => {
      const s = setup();
      await s.transfer();
      s.handlers.takeover = async () => ({ kind: "rejected", code, retryable: false });
      await s.engine.takeOver();
      await s.engine.retry();
      await vi.advanceTimersByTimeAsync(10000);
      expect(s.operations().slice(-1)).toEqual(["takeover"]);
      expect(s.operations()).not.toContain("recover");
      expect(s.engine.getSnapshot()).toMatchObject({
        pendingCommand: null,
        lifecycleError: { code, retryable: false },
      });
    },
  );

  it.each(["alphabet", "time-trial"] as const)(
    "%s recovers the terminal result of a transfer after the deadline without another start",
    async (mode) => {
      const s = setup(mode);
      await s.transfer();
      await vi.advanceTimersByTimeAsync(61000);
      await s.engine.takeOver();
      expect(s.operations()).toEqual(["prepareSession", "start", "takeover", "recover"]);
      expect(s.engine.getSnapshot()).toMatchObject({ phase: "results", score: 100 });
    },
  );

  it("cancels transfer retries and ignores its late result on disposal", async () => {
    const s = setup();
    await s.transfer();
    const pending = deferred<GameSessionResult>();
    s.handlers.takeover = () => pending.promise;
    const transferring = s.engine.takeOver();
    await drain();
    s.engine.dispose();
    const snapshot = s.engine.getSnapshot();
    pending.resolve(accepted({ sessionId: "session", revision: 8 }));
    await transferring;
    await vi.advanceTimersByTimeAsync(10000);
    expect(s.engine.getSnapshot()).toBe(snapshot);
    expect(s.operations()).not.toContain("recover");
  });
});

it("keeps abandonment confirmation inside the engine and sends nothing when cancelled", async () => {
  const s = setup();
  await s.play();
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  vi.stubGlobal("window", { confirm });
  await s.engine.abandon();
  expect(s.operations()).not.toContain("abandon");
  await s.engine.abandon();
  expect(confirm).toHaveBeenNthCalledWith(1, "¿Abandonar este intento? No podrás retomarlo.");
  expect(s.operations().filter((op) => op === "abandon")).toHaveLength(1);
});
