import { describe, expect, it } from "vitest";
import {
  calculateQueensMetrics,
  calculateQueensDraftMetrics,
  countQueensSolutions,
  getQueensConflicts,
  isQueensAnswer,
  isValidQueensConfiguration,
  queensGrid,
} from "@/lib/queens";
import { evaluateAnswer } from "@/lib/scoring";
import type { QueensBoardSize, QueensQuestion } from "@/types/game";

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

const dynamicFixtures: Array<{
  size: QueensBoardSize;
  regions: number[];
  solution: number[];
}> = [
  {
    size: 4,
    regions: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 3, 3, 3, 2],
    solution: [2, 4, 11, 13],
  },
  {
    size: 6,
    regions: [
      0, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 5, 2, 2, 1, 1, 3, 5, 5, 5, 4, 1, 5, 5, 5,
      5, 5, 5, 5, 5,
    ],
    solution: [0, 9, 13, 22, 26, 35],
  },
  {
    size: 8,
    regions: [
      0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 3, 4, 4, 1, 4,
      1, 2, 2, 4, 4, 4, 4, 4, 5, 2, 2, 4, 4, 4, 5, 5, 5, 2, 4, 4, 6, 6, 6, 5, 5, 2, 4, 4, 6, 6, 6,
      7, 5,
    ],
    solution: [1, 13, 16, 26, 36, 47, 51, 62],
  },
];

function fixtureQuestion(size: QueensBoardSize, regions: number[], solution: number[]) {
  return {
    ...question,
    id: `queens-${size}x${size}`,
    question: `Coloca ${size} coronas.`,
    grid: queensGrid(size),
    regions,
    solution,
  } satisfies QueensQuestion;
}

describe("Queens configuration", () => {
  it("accepts the curated unique board", () => {
    expect(isValidQueensConfiguration(question)).toBe(true);
    expect(countQueensSolutions(question)).toBe(1);
    expect(isValidQueensConfiguration({ ...question, prefilledQueens: [2] })).toBe(true);
  });

  it.each(dynamicFixtures)(
    "accepts a unique $size x $size board",
    ({ size, regions, solution }) => {
      const fixture = fixtureQuestion(size, regions, solution);
      expect(isValidQueensConfiguration(fixture)).toBe(true);
      expect(countQueensSolutions(fixture)).toBe(1);
      expect(calculateQueensDraftMetrics(fixture, solution)).toMatchObject({
        placedQueens: size,
        completedRows: size,
        completedColumns: size,
        completedRegions: size,
        solved: true,
      });
    },
  );

  it("rejects unsupported or rectangular board sizes", () => {
    expect(
      isValidQueensConfiguration({
        ...question,
        grid: { rows: 3, columns: 3 },
      } as unknown as QueensQuestion),
    ).toBe(false);
    expect(
      isValidQueensConfiguration({
        ...question,
        grid: { rows: 9, columns: 9 },
      } as unknown as QueensQuestion),
    ).toBe(false);
    expect(
      isValidQueensConfiguration({
        ...question,
        grid: { rows: 4, columns: 5 },
      } as unknown as QueensQuestion),
    ).toBe(false);
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
  it("calculates public draft metrics without needing the solution", () => {
    expect(calculateQueensDraftMetrics(question, [2, 9])).toMatchObject({
      placedQueens: 2,
      completedRows: 2,
      completedColumns: 2,
      completedRegions: 2,
      conflictingQueens: 0,
      solved: false,
    });
    const invalid = calculateQueensDraftMetrics(question, [0, 2, 5, 14, 20]);
    expect(invalid.placedQueens).toBe(5);
    expect(invalid.conflictingQueens).toBeGreaterThan(0);
    expect(invalid.solved).toBe(false);
  });

  it("reports row, column, region and contact conflicts", () => {
    expect(getQueensConflicts(question, [0, 1]).get(0)).toContain("row");
    expect(getQueensConflicts(question, [0, 5]).get(0)).toContain("column");
    expect(getQueensConflicts(question, [0, 6]).get(0)).toContain("region");
    expect(getQueensConflicts(question, [6, 10]).get(6)).toEqual(new Set(["contact"]));
  });

  it("does not treat the last cell of a row as adjacent to the first cell of the next row", () => {
    const fixture = fixtureQuestion(4, dynamicFixtures[0].regions, dynamicFixtures[0].solution);
    expect(getQueensConflicts(fixture, [3, 4]).size).toBe(0);
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
