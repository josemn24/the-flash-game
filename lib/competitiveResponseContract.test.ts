import { describe, expect, it } from "vitest";
import { timeTrialState, wordHashtagState, formatFields } from "./competitiveResponseContract";
import { WORD_HASHTAG_ACTIVE_CELLS } from "./wordHashtag";

const letters = Array.from({ length: 25 }, (_, i) =>
  WORD_HASHTAG_ACTIVE_CELLS.includes(i) ? "Ñ" : null,
);
const board = { letters, correctCells: [1, 3], movesUsed: 1, movesRemaining: 6 };
const running = {
  kind: "time-trial",
  currentIndex: 0,
  solvedCount: 0,
  totalCount: 2,
  points: 0,
  elapsedTimeMs: 0,
  clockStartedAt: "2026-10-01T10:00:00Z",
  deadlineAt: "2026-10-01T10:02:00Z",
  serverNow: "2026-10-01T10:00:01Z",
  lastCorrectElapsedMs: null,
  endReason: null,
};
const context = { timeLimitMs: 120000, totalCount: 2 };

describe("public progress invariants", () => {
  it("accepts canonical Hashtag progress and identical replay without an increment constraint", () => {
    expect(() => wordHashtagState(board, 7)).not.toThrow();
    expect(() => wordHashtagState(structuredClone(board), 7)).not.toThrow();
  });
  it.each([
    { ...board, letters: [] },
    { ...board, letters: letters.slice(1) },
    { ...board, letters: letters.map((v, i) => (i === 0 ? "A" : v)) },
    { ...board, letters: letters.map((v, i) => (i === 1 ? null : v)) },
    { ...board, letters: letters.map((v, i) => (i === 1 ? "AB" : v)) },
    { ...board, correctCells: undefined },
    { ...board, correctCells: [0] },
    { ...board, correctCells: [1, 1] },
    { ...board, correctCells: [3, 1] },
    { ...board, correctCells: [25] },
    { ...board, movesUsed: -1 },
    { ...board, movesRemaining: 7 },
  ])("rejects malformed Hashtag state %#", (value) => {
    expect(() => wordHashtagState(value, 7)).toThrow();
  });
});

describe("authoritative global clock variants", () => {
  it("permits an unstarted clock only in waiting or abandonment variants", () => {
    const waiting = { timeTrial: { ...running, clockStartedAt: null, deadlineAt: null } };
    expect(() => timeTrialState(waiting, context, "waiting-or-running")).not.toThrow();
    expect(() => timeTrialState(waiting, context, "running")).toThrow();
    expect(() => timeTrialState(waiting, context, "result")).toThrow();
  });
  it.each([
    {},
    { timeTrial: null },
    { timeTrial: running, deadlineAt: "2026-10-01T10:03:00Z" },
    { timeTrial: { ...running, deadlineAt: null } },
    { timeTrial: { ...running, clockStartedAt: null } },
    { timeTrial: { ...running, deadlineAt: "2026-10-01T10:03:00Z" } },
    { timeTrial: { ...running, totalCount: 3 } },
    { timeTrial: { ...running, currentIndex: 1 } },
    { timeTrial: { ...running, serverNow: "broken" } },
  ])("rejects missing or incoherent clocks %#", (value) => {
    expect(() => timeTrialState(value, context, "running")).toThrow();
  });
  it("requires a terminal reason for regulatory completion and preserves timestamps on replay", () => {
    expect(() => timeTrialState({ timeTrial: running }, context, "result")).toThrow();
    const result = { timeTrial: { ...running, endReason: "time_limit" } };
    expect(() => timeTrialState(result, context, "result")).not.toThrow();
    expect(() =>
      timeTrialState(
        { timeTrial: { ...result.timeTrial, serverNow: "2026-10-01T10:04:00Z" } },
        context,
        "result",
      ),
    ).not.toThrow();
    expect(result.timeTrial.deadlineAt).toBe(running.deadlineAt);
  });
});

describe("Hashtag operation acknowledgements", () => {
  it("keeps zero valid for initial progress but rejects a zero-move swap", () => {
    const initial = { ...board, movesUsed: 0, movesRemaining: 7, terminal: false };
    expect(() => wordHashtagState(initial, 7)).not.toThrow();
    expect(() => formatFields("wordHashtagSwap", initial, false)).toThrow("response.movesUsed");
    expect(() => formatFields("wordHashtagSwap", initial, true)).toThrow("response.movesUsed");
  });
  it("accepts an identical final-move replay without incrementing counters", () => {
    const result = {
      ...board,
      movesUsed: 7,
      movesRemaining: 0,
      terminal: true,
      receiptId: "receipt",
      status: "partial",
      points: 50,
      timeUsedMs: 1000,
    };
    for (let replay = 0; replay < 2; replay++) {
      expect(() => wordHashtagState(result, 7)).not.toThrow();
      expect(() => formatFields("wordHashtagSwap", result, false)).not.toThrow();
      expect(() => formatFields("wordHashtagSwap", result, true)).not.toThrow();
    }
    expect(result).toMatchObject({ movesUsed: 7, movesRemaining: 0 });
  });
});
