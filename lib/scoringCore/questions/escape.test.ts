import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "@/lib/scoring";
import type { EscapeQuestion } from "@/types/game";

const question: EscapeQuestion = {
  id: "escape-scoring",
  type: "escape",
  category: "Lógica",
  tags: {
    domains: ["mathematics"],
    topics: ["spatial_logic_puzzles"],
    cognitiveSkills: ["problem_solving"],
    formatSkills: ["planning"],
  },
  question: "Libera el bloque amarillo.",
  timeLimit: 45,
  points: 150,
  explanation: "Despeja la salida.",
  grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
  initialBlocks: [
    { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
    { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
    { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
    { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
    { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
  ],
  referenceSolution: [
    { blockId: "c", from: 1, to: 0 },
    { blockId: "a", from: 1, to: 0 },
    { blockId: "b", from: 0, to: 3 },
    { blockId: "target", from: 0, to: 4 },
  ],
  optimalMoves: 4,
};

describe("escape scoring", () => {
  it("awards binary speed points only after a valid escape", () => {
    const fast = evaluateAnswer({
      question,
      answer: { moves: question.referenceSolution },
      timeUsed: 8,
    });
    const slow = evaluateAnswer({
      question,
      answer: { moves: question.referenceSolution },
      timeUsed: 35,
    });

    expect(fast).toMatchObject({ status: "correct", isCorrect: true });
    expect(fast.points).toBeGreaterThan(slow.points);
    expect(slow.points).toBeGreaterThan(0);
    expect(fast.details).toEqual({ type: "escape", moves: 4, optimalMoves: 4, escaped: true });
  });

  it("does not penalize extra legal movements at the same time", () => {
    const extraMoves = [
      { blockId: "b", from: 0, to: 1 },
      { blockId: "b", from: 1, to: 0 },
      ...question.referenceSolution,
    ];
    const optimal = evaluateAnswer({
      question,
      answer: { moves: question.referenceSolution },
      timeUsed: 15,
    });
    const exploratory = evaluateAnswer({
      question,
      answer: { moves: extraMoves },
      timeUsed: 15,
    });

    expect(exploratory.points).toBe(optimal.points);
    expect(exploratory.details).toEqual({
      type: "escape",
      moves: 6,
      optimalMoves: 4,
      escaped: true,
    });
  });

  it("preserves valid draft details but awards no points on timeout", () => {
    const result = evaluateAnswer({
      question,
      answer: { moves: [{ blockId: "b", from: 0, to: 1 }] },
      timeUsed: 45,
      timedOut: true,
    });
    expect(result).toMatchObject({ status: "unanswered", isCorrect: false, points: 0 });
    expect(result.details).toEqual({ type: "escape", moves: 1, optimalMoves: 4, escaped: false });
  });

  it("rejects incomplete and manipulated answers", () => {
    expect(evaluateAnswer({ question, answer: { moves: [] }, timeUsed: 10 })).toMatchObject({
      status: "incorrect",
      points: 0,
    });
    expect(
      evaluateAnswer({
        question,
        answer: { moves: [{ blockId: "c", from: 0, to: 1 }] },
        timeUsed: 10,
      }),
    ).toMatchObject({ status: "incorrect", points: 0 });
  });
});
