import { describe, expect, it } from "vitest";
import {
  calculateQueensMetrics,
  countQueensSolutions,
  getQueensConflicts,
  isQueensAnswer,
  isValidQueensConfiguration,
} from "@/lib/queens";
import { evaluateAnswer } from "@/lib/scoring";
import type { QueensQuestion } from "@/types/game";

const question: QueensQuestion = {
  id: "queens-test",
  type: "queens",
  category: "Lógica espacial",
  tags: {
    domains: ["mathematics"],
    topics: ["spatial_logic_puzzles"],
    cognitiveSkills: ["logical_reasoning"],
    formatSkills: ["deduction"],
  },
  question: "Coloca cinco coronas.",
  grid: { rows: 5, columns: 5 },
  regions: [0, 0, 0, 1, 1, 2, 0, 1, 1, 1, 2, 2, 1, 3, 1, 2, 3, 3, 3, 3, 2, 4, 3, 3, 3],
  solution: [2, 9, 10, 18, 21],
  timeLimit: 60,
  points: 150,
  explanation: "Solución de prueba.",
};

describe("Queens configuration", () => {
  it("accepts the curated unique board", () => {
    expect(isValidQueensConfiguration(question)).toBe(true);
    expect(countQueensSolutions(question)).toBe(1);
    expect(isValidQueensConfiguration({ ...question, prefilledQueens: [2] })).toBe(true);
  });

  it("rejects malformed, disconnected and incorrect configurations", () => {
    expect(
      isValidQueensConfiguration({ ...question, regions: question.regions.slice(0, -1) }),
    ).toBe(false);
    expect(
      isValidQueensConfiguration({
        ...question,
        regions: question.regions.map((region, cell) => (cell === 24 ? 5 : region)),
      }),
    ).toBe(false);
    expect(
      isValidQueensConfiguration({
        ...question,
        regions: question.regions.map((region, cell) => (cell === 1 ? 4 : region)),
      }),
    ).toBe(false);
    expect(isValidQueensConfiguration({ ...question, solution: [0, 6, 12, 18, 24] })).toBe(false);
    expect(isValidQueensConfiguration({ ...question, prefilledQueens: [2, 2] })).toBe(false);
    expect(isValidQueensConfiguration({ ...question, prefilledQueens: [0] })).toBe(false);
  });

  it("detects ambiguous and impossible connected region layouts", () => {
    const ambiguous = {
      ...question,
      regions: Array.from({ length: 25 }, (_, cell) => Math.floor(cell / 5)),
    };
    const impossible = {
      ...question,
      regions: [4, 0, 0, 0, 0, 4, 3, 0, 0, 0, 2, 3, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1],
    };
    expect(countQueensSolutions(ambiguous)).toBe(2);
    expect(isValidQueensConfiguration(ambiguous)).toBe(false);
    expect(countQueensSolutions(impossible)).toBe(0);
    expect(isValidQueensConfiguration(impossible)).toBe(false);
  });
});

describe("Queens conflicts and answers", () => {
  it("reports row, column, region and contact conflicts", () => {
    expect(getQueensConflicts(question, [0, 1]).get(0)).toContain("row");
    expect(getQueensConflicts(question, [0, 5]).get(0)).toContain("column");
    expect(getQueensConflicts(question, [0, 6]).get(0)).toContain("region");
    expect(getQueensConflicts(question, [6, 10]).get(6)).toEqual(new Set(["contact"]));
  });

  it("counts a crown once when it participates in several conflicts", () => {
    const metrics = calculateQueensMetrics(question, { queens: [0, 5], marks: [] });
    expect(getQueensConflicts(question, [0, 5]).get(0)).toEqual(new Set(["column", "contact"]));
    expect(metrics.conflictingQueens).toBe(2);
  });

  it("validates disjoint cell lists and ignores marks for completion", () => {
    expect(isQueensAnswer({ queens: question.solution, marks: [1, 3] })).toBe(true);
    expect(isQueensAnswer({ queens: [2], marks: [2] })).toBe(false);
    expect(isQueensAnswer({ queens: [2, 2], marks: [] })).toBe(false);
    expect(
      calculateQueensMetrics(question, { queens: question.solution, marks: [1, 3] }),
    ).toMatchObject({ solved: true, marksUsed: 2 });
  });
});

describe("Queens scoring", () => {
  const solved = { queens: question.solution, marks: [1] };

  it("awards speed points and subtracts five percent per conflicting placement", () => {
    expect(evaluateAnswer({ question, answer: solved, timeUsed: 0 }).points).toBe(150);
    expect(
      evaluateAnswer({ question, answer: solved, timeUsed: 0, incorrectAttempts: 1 }).points,
    ).toBe(142);
    expect(evaluateAnswer({ question, answer: solved, timeUsed: 60 }).points).toBe(90);
    expect(
      evaluateAnswer({ question, answer: solved, timeUsed: 0, incorrectAttempts: 20 }).points,
    ).toBe(0);
  });

  it("does not award unresolved boards", () => {
    expect(
      evaluateAnswer({ question, answer: { queens: [2, 9], marks: [1] }, timeUsed: 10 }),
    ).toMatchObject({ status: "partial", points: 0, isCorrect: false });
  });

  it("preserves the draft and metrics on timeout without awarding points", () => {
    const answer = { queens: [2, 9], marks: [1, 3] };
    expect(
      evaluateAnswer({
        question,
        answer,
        timeUsed: 60,
        timedOut: true,
        incorrectAttempts: 2,
      }),
    ).toMatchObject({
      answer,
      status: "unanswered",
      points: 0,
      details: {
        type: "queens",
        placedQueens: 2,
        marksUsed: 2,
        incorrectAttempts: 2,
        solved: false,
      },
    });
  });
});
