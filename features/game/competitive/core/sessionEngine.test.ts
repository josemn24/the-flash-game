import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameRoomContext } from "@/types/view-models/room";
import type {
  ServerAlphabetChallenge,
  ServerFlashChallenge,
  ServerNarrativeChallenge,
  ServerPyramidChallenge,
} from "@/types/gameplay/challenge";
import { createCompetitiveAttemptClient } from "../attemptClient";
import { CompetitiveCommandError } from "../transport";
import { CompetitiveSessionEngine } from "./sessionEngine";
import { initialSessionState, sessionReducer } from "./sessionReducer";

const context = { attemptStatus: null, result: null } as unknown as GameRoomContext;
const choicePayload = { question: "Elige", options: ["A", "B"] };
const base = {
  id: "challenge",
  definitionId: "definition",
  number: 1,
  title: "Test",
  subtitle: "",
  description: "",
  maxScore: 20,
};
const slot = (id: string, position = 1) => ({
  id,
  position,
  questionType: "multiple-choice" as const,
  payloadSchemaVersion: 1,
  timeLimitMs: 60000,
  points: 10,
});
const flash: ServerFlashChallenge = { ...base, mode: "flash", slots: [slot("a"), slot("b", 2)] };
const alphabet: ServerAlphabetChallenge = {
  ...base,
  mode: "alphabet",
  timeLimitMs: 135000,
  entries: ["A", "B", "C"].map((letter, index) => ({
    ...slot(letter, index + 1),
    letter,
    questionType: "short-text",
  })),
};
const result = {
  questionId: "a",
  answer: "A",
  status: "correct" as const,
  isCorrect: true,
  points: 10,
  timeUsed: 1,
};
const accepted = (lockVersion: number, status = "correct") => ({
  lockVersion,
  status,
  points: status === "correct" ? 10 : 0,
  timeUsedMs: 1000,
});
const prepared = (
  challengeItemId = "a",
  lockVersion = 2,
  publicPayload: object = choicePayload,
) => ({
  challengeItemId,
  lockVersion,
  publicPayload,
  presentedAt: new Date().toISOString(),
  deadlineAt: new Date(Date.now() + 60000).toISOString(),
});
function setup(
  challenge = flash as CompetitiveSessionEngine["options"]["challenge"],
  roomContext = context,
) {
  const client = createCompetitiveAttemptClient();
  const calls = Object.fromEntries(Object.keys(client).map((key) => [key, vi.fn()])) as unknown as {
    [K in keyof typeof client]: ReturnType<typeof vi.fn<(typeof client)[K]>>;
  };
  calls.prepareSession.mockResolvedValue({ ready: true });
  calls.start.mockResolvedValue({ attemptId: "attempt", lockVersion: 1 });
  calls.prepare.mockResolvedValue(prepared());
  calls.answer.mockResolvedValue(accepted(3));
  calls.complete.mockResolvedValue({ score: 20, lockVersion: 6, review: [] });
  const refresh = vi.fn();
  const engine = new CompetitiveSessionEngine({ challenge, roomContext, client: calls, refresh });
  engines.push(engine);
  return { engine, calls, refresh };
}
const engines: CompetitiveSessionEngine[] = [];
const play = async (engine: CompetitiveSessionEngine) => {
  await engine.lifecycle.begin();
  await engine.startQuestions();
};
async function drain() {
  for (let index = 0; index < 60; index++) await Promise.resolve();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
});
afterEach(() => {
  engines.splice(0).forEach((engine) => engine.dispose());
  vi.useRealTimers();
});

describe("competitive session ownership", () => {
  it("deduplicates accepted results and expires every transient field", () => {
    let state = initialSessionState("playing");
    state = sessionReducer(state, { type: "answer_accepted", result, phase: "transition" });
    expect(
      sessionReducer(state, { type: "answer_accepted", result, phase: "transition" }).results,
    ).toHaveLength(1);
    expect(sessionReducer(state, { type: "expired" })).toMatchObject({
      phase: "results",
      attemptExpired: true,
      pendingCommand: null,
      question: null,
      busy: false,
      locked: true,
    });
  });
  it("retries only preparation after an accepted answer, using its original command", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.prepare
      .mockRejectedValueOnce(new TypeError("lost prepare response"))
      .mockResolvedValue(prepared("b", 4));
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "preparing",
      locked: true,
      lifecycleError: { operation: "prepare" },
    });
    const command = calls.prepare.mock.calls[1][0];
    expect(command.lockVersion).toBe(3);
    await engine.retry();
    expect(calls.prepare.mock.calls[2][0]).toEqual(command);
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "playing",
      question: { id: "b" },
      results: [result],
    });
  });
  it("deduplicates repeated start and preparation actions before the first microtask", async () => {
    const { engine, calls } = setup();
    await Promise.all([engine.lifecycle.begin(), engine.lifecycle.begin()]);
    await Promise.all([engine.startQuestions(), engine.startQuestions()]);
    expect(calls.start).toHaveBeenCalledTimes(1);
    expect(calls.prepare).toHaveBeenCalledTimes(1);
  });
  it("asks for explicit confirmation, transfers once, and recovers without restarting", async () => {
    const { engine, calls } = setup();
    calls.start.mockRejectedValueOnce(
      new CompetitiveCommandError("attempt_control_required", 409, undefined, {
        attempt: {
          attemptId: "attempt",
          lockVersion: 7,
          deadlineAt: "2026-10-02T10:05:00.000Z",
        },
      }),
    );
    calls.takeover.mockResolvedValue({
      attemptId: "attempt",
      lockVersion: 8,
      deadlineAt: "2026-10-02T10:05:00.000Z",
      transferred: true,
    });
    calls.recover.mockResolvedValue({
      phase: "prepare",
      lockVersion: 9,
      answers: [],
      resolved: { challengeItemId: "a" },
    });
    await engine.lifecycle.begin();
    expect(engine.getSnapshot()).toMatchObject({
      phase: "intro",
      transfer: { attemptId: "attempt", lockVersion: 7 },
      startNotice: "Existe una sesión activa en otro dispositivo.",
    });
    await engine.takeOver();
    expect(calls.takeover).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId: "attempt", lockVersion: 7 }),
    );
    expect(calls.start).toHaveBeenCalledTimes(1);
    expect(calls.recover).toHaveBeenCalledWith({ attemptId: "attempt", lockVersion: 8 });
    expect(engine.getSnapshot()).toMatchObject({ attempt: { id: "attempt", lockVersion: 9 } });
  });

  it("treats a transferred session as terminal and cancels retries", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValueOnce(new CompetitiveCommandError("session_transferred", 401));
    await engine.interactions.submit("A");
    expect(engine.getSnapshot()).toMatchObject({
      phase: "recovering",
      locked: true,
      pendingCommand: null,
      lifecycleError: {
        code: "session_transferred",
        message: "Has continuado esta partida en otro dispositivo.",
      },
    });
    await engine.retry();
    expect(calls.answer).toHaveBeenCalledTimes(1);
  });
  it("retains an uncertain answer and blocks further writes until the exact retry", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValueOnce(new TypeError("lost response"));
    await engine.interactions.submit("A");
    expect(engine.getSnapshot().feedback?.message).toBe("No hemos podido confirmar tu respuesta.");
    const command = structuredClone(engine.getSnapshot().pendingCommand);
    await engine.interactions.submit("B");
    await engine.retry();
    expect(calls.answer).toHaveBeenCalledTimes(2);
    expect(calls.answer.mock.calls[1][0]).toEqual(command?.input);
    expect(engine.getSnapshot().results).toHaveLength(1);
  });
  it("honors Retry-After without polling or changing the rejected command", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValueOnce(new CompetitiveCommandError("rate_limited", 429, 4));
    await engine.interactions.submit("A");
    await engine.retry();
    await vi.advanceTimersByTimeAsync(3999);
    await engine.retry();
    expect(calls.answer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await engine.retry();
    expect(calls.answer.mock.calls[1]).toEqual(calls.answer.mock.calls[0]);
  });
  it("reconciles stale versions without rewriting or resending the old answer", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValue(new CompetitiveCommandError("stale_version", 409));
    calls.start.mockResolvedValue({ attemptId: "attempt", lockVersion: 8 });
    calls.recover.mockResolvedValue({
      phase: "prepare",
      lockVersion: 9,
      answers: [
        { challengeItemId: "a", answer: "A", status: "correct", points: 10, timeUsedMs: 1000 },
      ],
    });
    calls.prepare.mockResolvedValue(prepared("b", 10));
    await engine.interactions.submit("A");
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(calls.answer.mock.calls[0][0].lockVersion).toBe(2);
    expect(calls.recover).toHaveBeenCalledWith({ attemptId: "attempt", lockVersion: 8 });
    expect(engine.getSnapshot()).toMatchObject({
      attempt: { lockVersion: 10 },
      results: [result],
      question: { id: "b" },
    });
  });
  it("reloads the authorized result projection when a completion retry has no cookie", async () => {
    const { engine, calls, refresh } = setup({ ...flash, slots: [slot("a")] });
    await play(engine);
    calls.complete
      .mockRejectedValueOnce(new TypeError("lost complete response"))
      .mockRejectedValueOnce(new CompetitiveCommandError("attempt_session_missing", 401));
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(1100);
    await engine.retry();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.complete.mock.calls[1]).toEqual(calls.complete.mock.calls[0]);
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().lifecycleError?.operation).toBe("projection");
  });
  it("ignores late responses and cancels feedback timers on detach", async () => {
    const { engine, calls } = setup();
    await play(engine);
    let resolve!: (value: Record<string, unknown>) => void;
    calls.answer.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const promise = engine.interactions.submit("A");
    await drain();
    engine.dispose();
    const state = engine.getSnapshot();
    resolve(accepted(3));
    await promise;
    await vi.runAllTimersAsync();
    expect(engine.getSnapshot()).toBe(state);
    expect(calls.prepare).toHaveBeenCalledTimes(1);
  });
  it("starts recovery once across the StrictMode setup/cleanup replay", async () => {
    const { engine, calls } = setup(flash, { ...context, attemptStatus: "inProgress" });
    calls.recover.mockResolvedValue({ lockVersion: 2, phase: "countdown", answers: [] });
    const disconnect = engine.connect();
    disconnect();
    engine.connect();
    await drain();
    expect(calls.start).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().phase).toBe("countdown");
  });
  it("clears pending writes and presentation waits on server expiration", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValue(new CompetitiveCommandError("attempt_inactivity_expired", 410));
    await engine.interactions.submit("A");
    await engine.retry();
    await vi.runAllTimersAsync();
    expect(engine.getSnapshot()).toMatchObject({
      attemptExpired: true,
      phase: "results",
      pendingCommand: null,
      question: null,
    });
    expect(calls.answer).toHaveBeenCalledTimes(1);
  });
});
describe("mode policies", () => {
  it("advances Flash sequentially and completes after the last accepted answer", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.prepare.mockResolvedValue(prepared("b", 4));
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(1100);
    calls.answer.mockResolvedValue(accepted(5));
    await engine.interactions.submit("B");
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot()).toMatchObject({ phase: "results", score: 20 });
    expect(calls.complete.mock.calls[0][0].lockVersion).toBe(5);
  });
  it("ignores duplicate and late per-question timeout callbacks", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.prepare.mockResolvedValue(prepared("b", 4));
    await engine.interactions.submit("A");
    await engine.interactions.onTimeUp();
    expect(calls.answer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100);
    await engine.interactions.onTimeUp("a");
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().question?.id).toBe("b");
  });
  it("eliminates Survival from authorized results", async () => {
    const { engine, calls } = setup({ ...flash, mode: "survival", lives: 1 });
    await play(engine);
    calls.answer.mockResolvedValue(accepted(3, "incorrect"));
    await engine.interactions.submit("B");
    await vi.advanceTimersByTimeAsync(1800);
    expect(calls.prepare).toHaveBeenCalledTimes(1);
    expect(calls.complete).toHaveBeenCalledTimes(1);
  });
  it("keeps Pyramid preparation and activation separate and starts the clock at activation", async () => {
    const challenge: ServerPyramidChallenge = {
      ...base,
      mode: "pyramid",
      attemptVersion: 1,
      availableFrom: "",
      availableUntil: "",
      levels: [
        {
          ...slot("a"),
          levelId: "level",
          label: "Nivel",
          briefing: { title: "", format: "", description: "" },
        },
      ],
    };
    const { engine, calls } = setup(challenge);
    const preparedQuestion = { ...prepared(), presentedAt: null, deadlineAt: null };
    let resolvePreparation!: (response: typeof preparedQuestion) => void;
    calls.prepare.mockImplementation(
      () => new Promise((resolve) => (resolvePreparation = resolve)),
    );
    calls.activate
      .mockRejectedValueOnce(new TypeError("lost activation"))
      .mockResolvedValue(prepared("a", 3));
    await engine.lifecycle.begin();
    expect(engine.getSnapshot().phase).toBe("briefing");
    const preparing = engine.startQuestions();
    expect(engine.getSnapshot().phase).toBe("preparing");
    await drain();
    expect(engine.getSnapshot()).toMatchObject({
      phase: "preparing",
      busy: true,
      locked: true,
      question: null,
      questionDeadlineAt: null,
    });
    resolvePreparation(preparedQuestion);
    await preparing;
    expect(engine.getSnapshot()).toMatchObject({
      phase: "preparing",
      locked: true,
      questionDeadlineAt: null,
    });
    await engine.lifecycle.activate();
    expect(engine.getSnapshot()).toMatchObject({
      phase: "preparing",
      locked: true,
      questionDeadlineAt: null,
      lifecycleError: { operation: "activate" },
    });
    const original = calls.activate.mock.calls[0][0];
    await engine.retry();
    expect(calls.activate.mock.calls[1][0]).toEqual(original);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "playing",
      questionDeadlineAt: Date.now() + 60000,
    });
  });
  it.each(["flash", "pyramid"] as const)(
    "settles a %s interaction already expired at preparation or activation",
    async (mode) => {
      const challenge: ServerFlashChallenge | ServerPyramidChallenge =
        mode === "flash"
          ? { ...flash, slots: [slot("a")] }
          : {
              ...base,
              mode: "pyramid",
              attemptVersion: 1,
              availableFrom: "",
              availableUntil: "",
              levels: [
                {
                  ...slot("a"),
                  levelId: "level",
                  label: "Nivel",
                  briefing: { title: "", format: "", description: "" },
                },
              ],
            };
      const { engine, calls } = setup(challenge);
      const expired = {
        ...prepared("a", mode === "pyramid" ? 3 : 2),
        timedOut: true,
        deadlineAt: new Date(Date.now() - 1).toISOString(),
      };
      calls.prepare.mockResolvedValue(
        mode === "pyramid" ? { ...prepared(), deadlineAt: null, presentedAt: null } : expired,
      );
      calls.activate.mockResolvedValue(expired);
      calls.answer.mockResolvedValue(accepted(4, "unanswered"));
      await play(engine);
      if (mode === "pyramid") await engine.lifecycle.activate();
      expect(calls.answer).toHaveBeenCalledTimes(1);
      expect(calls.answer.mock.calls[0][0].answer).toBeNull();
      await vi.advanceTimersByTimeAsync(1800);
      expect(engine.getSnapshot().phase).toBe("results");
    },
  );
  it("uses specialized Narrative commands and advances into scenes without a competitive timeout", async () => {
    const challenge: ServerNarrativeChallenge = {
      ...base,
      mode: "narrative",
      slots: [{ ...slot("a"), questionType: "mini-wordle" }],
      prologue: { id: "intro", blocks: [] },
      beats: [
        {
          id: "beat",
          title: "",
          steps: [
            { type: "question", questionId: "a" },
            { type: "scene", scene: { id: "outro", blocks: [] } },
          ],
        },
      ],
    };
    const { engine, calls } = setup(challenge);
    calls.prepare.mockResolvedValue({
      ...prepared("a", 2, { question: "Palabra", wordLength: 4, maxAttempts: 6, hint: null }),
      presentedAt: null,
      deadlineAt: null,
    });
    calls.miniWordleGuess.mockResolvedValue({
      ...accepted(3),
      terminal: true,
      guess: "CASA",
      guesses: ["CASA"],
      attemptsUsed: 1,
      feedback: [],
    });
    await engine.lifecycle.begin();
    await engine.continueScene();
    await engine.interactions.onTimeUp();
    expect(calls.answer).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toMatchObject({ phase: "playing", locked: false });
    await engine.interactions.submitMiniWordleGuess("CASA");
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot()).toMatchObject({ phase: "scene", stepIndex: 2 });
    await engine.continueScene();
    expect(engine.getSnapshot().phase).toBe("results");
  });
  it("recovers Narrative at the persisted active cursor", async () => {
    const challenge: ServerNarrativeChallenge = {
      ...base,
      mode: "narrative",
      slots: flash.slots,
      prologue: { id: "intro", blocks: [] },
      beats: [
        {
          id: "beat",
          title: "",
          steps: [
            { type: "question", questionId: "a" },
            { type: "scene", scene: { id: "between", blocks: [] } },
            { type: "question", questionId: "b" },
          ],
        },
      ],
    };
    const { engine, calls } = setup(challenge);
    calls.recover.mockResolvedValue({
      phase: "prepare",
      lockVersion: 8,
      narrativeCursor: { currentChallengeItemId: "b" },
      answers: [
        { challengeItemId: "a", answer: "A", status: "correct", points: 10, timeUsedMs: 1000 },
      ],
    });
    calls.prepare.mockResolvedValue({ ...prepared("b", 9), presentedAt: null, deadlineAt: null });
    await engine.lifecycle.recover();
    expect(engine.getSnapshot()).toMatchObject({
      stepIndex: 3,
      questionIndex: 1,
      results: [result],
      phase: "playing",
    });
  });
  it("passes Alphabet letters and closes all remaining letters in one command after global expiry", async () => {
    const { engine, calls } = setup(alphabet);
    let index = 0;
    calls.prepare.mockImplementation(async () => {
      const item = ["A", "B", "C", "A"][index++]!;
      return {
        ...prepared(item, index * 2, { question: "Letra" }),
        timedOut: index > 2,
        publicPayload: index > 2 ? null : { question: "Letra" },
        progress: { kind: "alphabet", letters: [], round: 1 },
        deadlineAt: new Date(Date.now() + (index > 2 ? -1 : 135000)).toISOString(),
      };
    });
    calls.alphabetPass.mockResolvedValue({ lockVersion: 3 });
    calls.complete.mockResolvedValue({
      lockVersion: 6,
      score: 0,
      review: [],
      answers: ["A", "B", "C"].map((challengeItemId) => ({
        challengeItemId,
        answer: null,
        status: "unanswered",
        points: 0,
        timeUsedMs: 0,
      })),
    });
    calls.answer.mockImplementation(async (input) => accepted(input.lockVersion + 1, "unanswered"));
    await play(engine);
    await engine.interactions.pass();
    expect(engine.getSnapshot().question?.id).toBe("B");
    const one = engine.interactions.onTimeUp();
    const two = engine.interactions.onTimeUp();
    await Promise.all([one, two]);
    expect(calls.answer).not.toHaveBeenCalled();
    expect(calls.prepare).toHaveBeenCalledTimes(2);
    expect(calls.complete).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().results).toHaveLength(3);
  });
});

describe("format coordination", () => {
  it("returns a rejected matching answer to its editable question with visible feedback", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "matching" }],
    });
    const items = ["one", "two", "three"].map((id) => ({ id, label: id }));
    calls.prepare.mockResolvedValue(
      prepared("a", 2, { question: "Parejas", leftItems: items, rightItems: items }),
    );
    calls.answer.mockRejectedValueOnce(new CompetitiveCommandError("invalid_matching_answer", 400));
    await play(engine);
    await engine.interactions.submit({});
    expect(engine.getSnapshot()).toMatchObject({
      phase: "playing",
      locked: false,
      pendingCommand: null,
      feedback: { channel: "submission", state: "error", visible: true },
    });
  });
  it("shows a rejected Hashtag swap and permits a different move without consuming it", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "word-hashtag" }],
    });
    const letters = [
      null,
      "G",
      null,
      "Q",
      null,
      "E",
      "O",
      "P",
      "U",
      "I",
      null,
      "N",
      null,
      "Y",
      null,
      "R",
      "A",
      "U",
      "M",
      "E",
      null,
      "R",
      null,
      "A",
      null,
    ];
    calls.prepare.mockResolvedValue(
      prepared("a", 2, {
        question: "Hashtag",
        grid: { rows: 5, columns: 5 },
        initialLetters: letters,
        maxMoves: 7,
      }),
    );
    calls.wordHashtagSwap
      .mockRejectedValueOnce(new CompetitiveCommandError("invalid_word_hashtag_swap", 400))
      .mockResolvedValue({
        lockVersion: 3,
        letters,
        correctCells: [],
        movesUsed: 1,
        movesRemaining: 6,
        terminal: false,
      });
    await play(engine);
    await engine.interactions.submitWordHashtagSwap(5, 19);
    expect(engine.getSnapshot()).toMatchObject({
      locked: false,
      pendingCommand: null,
      feedback: {
        channel: "submission",
        state: "error",
        visible: true,
        message: "Ese intercambio no está permitido.",
      },
      question: { progress: { movesUsed: 0 } },
    });
    await engine.interactions.submitWordHashtagSwap(1, 7);
    expect(calls.wordHashtagSwap.mock.calls[1][0]).toMatchObject({
      lockVersion: 2,
      fromCell: 1,
      toCell: 7,
    });
    expect(engine.getSnapshot()).toMatchObject({
      locked: false,
      question: { progress: { movesUsed: 1 } },
    });
  });
  const queensPayload = {
    question: "Coronas",
    grid: { rows: 4, columns: 4 },
    regions: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 3, 3, 3, 2],
    prefilledQueens: [2],
  };
  const queensResponse = (lockVersion: number, queens: readonly number[]) => ({
    lockVersion,
    queens,
    placedQueens: queens.length,
    completedRows: queens.length,
    completedColumns: queens.length,
    completedRegions: queens.length,
    conflictingQueens: 0,
    solved: false,
    terminal: false,
  });
  it("preserves a newer queued Queens draft when the preceding draft loses its response", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "queens" }],
    });
    calls.prepare.mockResolvedValue(prepared("a", 2, queensPayload));
    let reject!: (error: Error) => void;
    calls.queensDraft
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockImplementation(async (input) => queensResponse(input.lockVersion + 1, input.queens));
    await play(engine);
    engine.interactions.updateQueensDraft([2, 4]);
    await vi.advanceTimersByTimeAsync(300);
    engine.interactions.updateQueensDraft([2, 4, 11]);
    await vi.advanceTimersByTimeAsync(300);
    reject(new TypeError("lost draft response"));
    await drain();
    expect(calls.queensDraft).toHaveBeenCalledTimes(1);
    await engine.retry();
    expect(calls.queensDraft.mock.calls[1]).toEqual(calls.queensDraft.mock.calls[0]);
    expect(calls.queensDraft.mock.calls[2][0]).toMatchObject({
      lockVersion: 3,
      queens: [2, 4, 11],
    });
    expect(engine.getSnapshot().question).toMatchObject({ progress: { queens: [2, 4, 11] } });
  });
  it("serializes queued Queens drafts and resolves versions at dispatch before validation", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "queens" }],
    });
    calls.prepare.mockResolvedValue(prepared("a", 2, queensPayload));
    let resolve!: (value: Record<string, unknown>) => void;
    calls.queensDraft
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockImplementation(async (input) => queensResponse(input.lockVersion + 1, input.queens));
    calls.queensValidation.mockResolvedValue({
      ...queensResponse(5, [2, 4, 11, 13]),
      ...accepted(5),
      terminal: true,
    });
    await play(engine);
    engine.interactions.updateQueensDraft([2, 4]);
    await vi.advanceTimersByTimeAsync(300);
    const validation = engine.interactions.validateQueensBoard([2, 4, 11, 13]);
    await drain();
    expect(calls.queensDraft).toHaveBeenCalledTimes(1);
    expect(calls.queensValidation).not.toHaveBeenCalled();
    resolve(queensResponse(3, [2, 4]));
    await validation;
    expect(calls.queensDraft.mock.calls[1][0]).toMatchObject({
      lockVersion: 3,
      queens: [2, 4, 11, 13],
    });
    expect(calls.queensValidation.mock.calls[0][0].lockVersion).toBe(4);
    expect(engine.getSnapshot().results).toHaveLength(1);
  });
  it("keeps a lost Queens draft blocked and retries its original payload before validating", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "queens" }],
    });
    calls.prepare.mockResolvedValue(prepared("a", 2, queensPayload));
    calls.queensDraft
      .mockRejectedValueOnce(new TypeError("lost draft"))
      .mockImplementation(async (input) => queensResponse(input.lockVersion + 1, input.queens));
    calls.queensValidation.mockResolvedValue({
      ...queensResponse(4, [2, 4, 11, 13]),
      ...accepted(4),
      terminal: true,
    });
    await play(engine);
    engine.interactions.updateQueensDraft([2, 4]);
    await vi.advanceTimersByTimeAsync(300);
    await engine.interactions.validateQueensBoard([2, 4, 11, 13]);
    expect(calls.queensValidation).not.toHaveBeenCalled();
    await engine.retry();
    expect(calls.queensDraft.mock.calls[1]).toEqual(calls.queensDraft.mock.calls[0]);
    expect(calls.queensValidation).toHaveBeenCalledTimes(1);
  });
  it("resumes an expired timer after retrying a lost partial-format response", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "mini-wordle" }],
    });
    calls.prepare.mockResolvedValue(
      prepared("a", 2, { question: "Palabra", wordLength: 4, maxAttempts: 6, hint: null }),
    );
    calls.miniWordleGuess.mockRejectedValueOnce(new TypeError("lost response")).mockResolvedValue({
      lockVersion: 3,
      terminal: false,
      guess: "CASA",
      attemptsUsed: 1,
      feedback: [],
    });
    await play(engine);
    await engine.interactions.submitMiniWordleGuess("CASA");
    await engine.interactions.onTimeUp();
    await engine.retry();
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(calls.answer.mock.calls[0][0].lockVersion).toBe(3);
  });
  it("flushes an in-flight Queens draft before processing an expired timer", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "queens" }],
    });
    calls.prepare.mockResolvedValue(prepared("a", 2, queensPayload));
    let resolve!: (value: Record<string, unknown>) => void;
    calls.queensDraft.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await play(engine);
    engine.interactions.updateQueensDraft([2, 4]);
    await vi.advanceTimersByTimeAsync(300);
    await engine.interactions.onTimeUp();
    resolve(queensResponse(3, [2, 4]));
    await drain();
    expect(calls.answer).toHaveBeenCalledTimes(1);
    expect(calls.answer.mock.calls[0][0].lockVersion).toBe(3);
  });
  it("keeps the Pyramid Mini-Wordle answer reveal before feedback and completion", async () => {
    const challenge: ServerPyramidChallenge = {
      ...base,
      mode: "pyramid",
      attemptVersion: 1,
      availableFrom: "",
      availableUntil: "",
      levels: [
        {
          ...slot("a"),
          questionType: "mini-wordle",
          levelId: "level",
          label: "Nivel",
          briefing: { title: "", format: "", description: "" },
        },
      ],
    };
    const { engine, calls } = setup(challenge);
    calls.prepare.mockResolvedValue({
      ...prepared("a", 2, { question: "Palabra", wordLength: 4, maxAttempts: 6, hint: null }),
      presentedAt: null,
      deadlineAt: null,
    });
    calls.activate.mockResolvedValue(prepared("a", 3));
    calls.miniWordleGuess.mockResolvedValue({
      ...accepted(4),
      terminal: true,
      guess: "CASA",
      attemptsUsed: 1,
      feedback: [],
    });
    await play(engine);
    await engine.lifecycle.activate();
    await engine.interactions.submitMiniWordleGuess("CASA");
    expect(engine.getSnapshot()).toMatchObject({
      phase: "answer-reveal",
      questionDeadlineAt: null,
    });
    await vi.advanceTimersByTimeAsync(699);
    expect(engine.getSnapshot().phase).toBe("answer-reveal");
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.getSnapshot().phase).toBe("transition");
    expect(calls.complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot().phase).toBe("results");
  });
  it("uses the updated Word Search lock version when its timer expires", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "word-search" }],
    });
    calls.prepare.mockResolvedValue(
      prepared("a", 2, {
        question: "Busca",
        grid: { rows: 6, columns: 6 },
        letters: Array(36).fill("A"),
        targets: [
          { id: "one", word: "CASA" },
          { id: "two", word: "PERRO" },
        ],
      }),
    );
    calls.wordSearchSelection.mockResolvedValue({
      lockVersion: 3,
      foundSelections: [],
      foundWordIds: [],
      foundCount: 0,
      totalWords: 2,
      incorrectAttempts: 1,
      correct: false,
      terminal: false,
    });
    await play(engine);
    await engine.interactions.submitWordSearchSelection(0, 3);
    await engine.interactions.onTimeUp();
    expect(calls.answer.mock.calls[0][0].lockVersion).toBe(3);
    expect(engine.getSnapshot().results).toHaveLength(1);
  });
  it("preserves Narrative question deadlines while scenes and reactions have no timer", async () => {
    const challenge: ServerNarrativeChallenge = {
      ...base,
      mode: "narrative",
      slots: [slot("a")],
      prologue: { id: "intro", blocks: [] },
      beats: [{ id: "beat", title: "", steps: [{ type: "question", questionId: "a" }] }],
    };
    const { engine, calls } = setup(challenge);
    await engine.lifecycle.begin();
    await engine.interactions.onTimeUp();
    expect(calls.answer).not.toHaveBeenCalled();
    await engine.continueScene();
    await engine.interactions.onTimeUp();
    expect(calls.answer.mock.calls[0][0].answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot().phase).toBe("results");
  });
});

describe("Alphabet atomic finalization", () => {
  it.each([1, 5, 18, 20])(
    "closes %i pending letters with one complete and no null answers",
    async (count) => {
      const challenge = {
        ...alphabet,
        entries: Array.from({ length: count }, (_, i) => ({
          ...alphabet.entries[0]!,
          id: `letter-${i}`,
          letter: String.fromCharCode(65 + i),
          position: i + 1,
        })),
      };
      const { engine, calls } = setup(challenge);
      calls.prepare.mockResolvedValue({
        ...prepared("letter-0", 2, { question: "Letra" }),
        progress: { kind: "alphabet", letters: [], round: 1 },
      });
      const answers = challenge.entries.map((entry) => ({
        challengeItemId: entry.id,
        answer: null,
        status: "unanswered",
        points: 0,
        timeUsedMs: 0,
      }));
      calls.complete.mockResolvedValue({ lockVersion: 3, score: 0, review: [], answers });
      await play(engine);
      await Promise.all([engine.interactions.onTimeUp(), engine.interactions.onTimeUp()]);
      expect(calls.complete).toHaveBeenCalledTimes(1);
      expect(calls.answer).not.toHaveBeenCalled();
      expect(calls.prepare).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot()).toMatchObject({ phase: "results", score: 0 });
      expect(engine.getSnapshot().results).toHaveLength(count);
    },
  );

  it("completes immediately when prepare reports an expired global deadline", async () => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue({
      ...prepared("A", 2),
      publicPayload: null,
      timedOut: true,
      progress: { kind: "alphabet", letters: [], round: 1 },
    });
    await play(engine);
    expect(calls.complete).toHaveBeenCalledOnce();
    expect(calls.answer).not.toHaveBeenCalled();
  });

  it("automatically retries a lost recovery response after an expired Alphabet", async () => {
    const { engine, calls } = setup(alphabet, { ...context, attemptStatus: "inProgress" });
    calls.start.mockResolvedValue({
      attemptId: "attempt",
      lockVersion: 2,
      deadlineAt: new Date(Date.now() - 1000).toISOString(),
    });
    calls.recover.mockRejectedValueOnce(new CompetitiveCommandError("command_failed", 503));
    calls.recover.mockResolvedValue({
      lockVersion: 3,
      phase: "results",
      score: 0,
      answers: [],
      review: [],
    });
    await engine.lifecycle.recover();
    expect(engine.getSnapshot()).toMatchObject({
      phase: "finalizing",
      locked: true,
      completionRetryScheduled: true,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.recover.mock.calls[1]).toEqual(calls.recover.mock.calls[0]);
    expect(engine.getSnapshot().phase).toBe("results");
    expect(calls.prepare).not.toHaveBeenCalled();
    expect(calls.answer).not.toHaveBeenCalled();
  });

  it.each(["answer", "alphabetPass"] as const)(
    "waits for an in-flight %s before finalizing",
    async (operation) => {
      const { engine, calls } = setup(alphabet);
      calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
      let resolve!: (value: Record<string, unknown>) => void;
      calls[operation].mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      await play(engine);
      const pending =
        operation === "answer"
          ? engine.interactions.submit("respuesta")
          : engine.interactions.pass();
      await drain();
      await engine.interactions.onTimeUp();
      expect(engine.getSnapshot()).toMatchObject({ phase: "finalizing", locked: true });
      expect(calls.complete).not.toHaveBeenCalled();
      resolve(accepted(3));
      await pending;
      expect(calls.complete).toHaveBeenCalledOnce();
      expect(calls.prepare).toHaveBeenCalledOnce();
    },
  );

  it("reconciles an uncertain in-flight answer and preserves the closing intent", async () => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
    let reject!: (reason: unknown) => void;
    calls.answer.mockImplementation(
      () =>
        new Promise((_, failed) => {
          reject = failed;
        }),
    );
    calls.start.mockResolvedValue({ attemptId: "attempt", lockVersion: 8 });
    calls.recover.mockResolvedValue({ lockVersion: 9, phase: "prepare", answers: [] });
    await play(engine);
    const pending = engine.interactions.submit("respuesta");
    await drain();
    await engine.interactions.onTimeUp();
    reject(new TypeError("response lost"));
    await pending;
    expect(calls.recover).toHaveBeenCalledOnce();
    expect(calls.complete).toHaveBeenCalledOnce();
    expect(calls.prepare).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().phase).toBe("results");
  });

  it("retries network failures three times at 1, 2 and 4 seconds, then allows a new manual cycle", async () => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
    calls.complete.mockRejectedValue(new TypeError("offline"));
    await play(engine);
    await engine.interactions.onTimeUp();
    const original = structuredClone(calls.complete.mock.calls[0]);
    expect(engine.getSnapshot().completionRetryScheduled).toBe(true);
    for (const [index, delay] of [1000, 2000, 4000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(calls.complete).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(calls.complete).toHaveBeenCalledTimes(index + 2);
    }
    await vi.advanceTimersByTimeAsync(60000);
    expect(calls.complete).toHaveBeenCalledTimes(4);
    expect(engine.getSnapshot().completionRetryScheduled).toBe(false);
    calls.complete.mockResolvedValue({ score: 0, lockVersion: 3, review: [] });
    await engine.retry();
    expect(
      calls.complete.mock.calls.every((call) => JSON.stringify(call) === JSON.stringify(original)),
    ).toBe(true);
    expect(engine.getSnapshot().phase).toBe("results");
  });

  it.each([
    new CompetitiveCommandError("rate_limited", 429, 4),
    new CompetitiveCommandError("alphabet_deadline_not_reached", 409, 4),
  ])("respects the server retry delay for %s", async (failure) => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
    calls.complete.mockRejectedValueOnce(failure);
    await play(engine);
    await engine.interactions.onTimeUp();
    await vi.advanceTimersByTimeAsync(3999);
    expect(calls.complete).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.complete.mock.calls[1]).toEqual(calls.complete.mock.calls[0]);
    expect(engine.getSnapshot().phase).toBe("results");
  });

  it("reconciles stale completion and submits with the recovered version", async () => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
    calls.complete.mockRejectedValueOnce(new CompetitiveCommandError("stale_version", 409));
    calls.start.mockResolvedValue({ attemptId: "attempt", lockVersion: 8 });
    calls.recover.mockResolvedValue({ lockVersion: 9, phase: "prepare", answers: [] });
    await play(engine);
    await engine.interactions.onTimeUp();
    expect(calls.complete.mock.calls[1][0].lockVersion).toBe(9);
    expect(calls.complete.mock.calls[1][0].idempotencyKey).not.toBe(
      calls.complete.mock.calls[0][0].idempotencyKey,
    );
    expect(engine.getSnapshot().phase).toBe("results");
  });

  it("cancels pending completion retries on detach", async () => {
    const { engine, calls } = setup(alphabet);
    calls.prepare.mockResolvedValue(prepared("A", 2, { question: "Letra" }));
    calls.complete.mockRejectedValue(new CompetitiveCommandError("database_unavailable", 503));
    await play(engine);
    await engine.interactions.onTimeUp();
    engine.dispose();
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls.complete).toHaveBeenCalledOnce();
  });
});

describe("bounded gameplay retries", () => {
  it("automatically retries an uncertain answer once with the exact input", async () => {
    const { engine, calls } = setup();
    await play(engine);
    calls.answer.mockRejectedValue(new TypeError("connection lost after commit"));
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(999);
    expect(calls.answer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.answer).toHaveBeenCalledTimes(2);
    expect(calls.answer.mock.calls[1]).toEqual(calls.answer.mock.calls[0]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(calls.answer).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().pendingCommand).not.toBeNull();
    expect(engine.getSnapshot().lifecycleError?.message).toBe(
      "No hemos podido confirmar la operación",
    );
    const clickEvent: { self?: unknown } = {};
    clickEvent.self = clickEvent;
    await engine.retry(clickEvent as unknown as boolean);
    expect(calls.answer).toHaveBeenCalledTimes(3);
  });
  it("gives a new input its own retry budget after a definitive rejection", async () => {
    const { engine, calls } = setup({
      ...flash,
      slots: [{ ...slot("a"), questionType: "mini-wordle" }],
    });
    calls.prepare.mockResolvedValue(
      prepared("a", 2, {
        question: "Palabra",
        wordLength: 4,
        maxAttempts: 6,
        hint: null,
      }),
    );
    calls.miniWordleGuess
      .mockRejectedValueOnce(new TypeError("lost response"))
      .mockRejectedValueOnce(new CompetitiveCommandError("invalid_mini_wordle_guess", 400))
      .mockRejectedValue(new TypeError("another lost response"));
    await play(engine);
    await engine.interactions.submitMiniWordleGuess("ZZZZ");
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.getSnapshot().pendingCommand).toBeNull();
    await engine.interactions.submitMiniWordleGuess("CASA");
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.miniWordleGuess).toHaveBeenCalledTimes(4);
    expect(calls.miniWordleGuess.mock.calls[3]).toEqual(calls.miniWordleGuess.mock.calls[2]);
  });
  it("stops retries and removes protected content after permission loss", async () => {
    const { engine, calls } = setup();
    calls.recover.mockResolvedValue({
      lockVersion: 4,
      phase: "results",
      status: "abandoned",
      terminalReason: "permission_revoked",
      score: 0,
      answers: [accepted(4)],
    });
    await play(engine);
    calls.answer
      .mockRejectedValueOnce(new TypeError("lost response"))
      .mockRejectedValue(new CompetitiveCommandError("not_authorized", 404));
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(1000);
    await drain();
    await engine.retry();
    await vi.advanceTimersByTimeAsync(10000);
    await drain();
    expect(calls.answer).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "results",
      locked: true,
      question: null,
      pendingCommand: null,
      lifecycleError: { code: "attempt_permission_revoked", retryable: false },
    });
  });
  it("keeps the completed score when the review is temporarily unavailable", async () => {
    const { engine, calls, refresh } = setup({ ...flash, slots: [slot("a")] });
    calls.complete.mockResolvedValue({
      lockVersion: 6,
      score: 20,
      review: [],
      reviewPending: true,
    });
    await play(engine);
    await engine.interactions.submit("A");
    await vi.advanceTimersByTimeAsync(1100);
    expect(engine.getSnapshot()).toMatchObject({
      phase: "results",
      score: 20,
      reviewChallenge: null,
      lifecycleError: { operation: "projection" },
    });
    calls.recover.mockResolvedValue({ lockVersion: 6, score: 20, review: [] });
    await engine.retry();
    expect(refresh).not.toHaveBeenCalled();
    expect(calls.recover).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().lifecycleError).toBeUndefined();
    expect(calls.complete).toHaveBeenCalledOnce();
  });
});
