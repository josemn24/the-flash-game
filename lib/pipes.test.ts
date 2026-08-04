import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import { evaluateAnswer } from "@/lib/scoring";
import {
  calculatePipesMetrics,
  countPipesSolutions,
  getPipesConnections,
  getPipesNeighbor,
  isPipesAnswer,
  isValidPipesConfiguration,
  rotatePipesTile,
} from "@/lib/pipes";

const question = QUESTION_FORMAT_CATALOG.pipes.examples[0].question;

describe("Pipes", () => {
  it("validates the authored unique tree configuration", () => {
    expect(isValidPipesConfiguration(question)).toBe(true);
    expect(countPipesSolutions(question)).toBe(1);
    expect(
      calculatePipesMetrics(question, { rotations: question.solutionRotations, moves: 12 }),
    ).toMatchObject({
      connectedTiles: 25,
      openConnections: 0,
      isolatedComponents: 0,
      solved: true,
    });
  });

  it("rotates pieces and exposes their cardinal connections", () => {
    expect(getPipesConnections("corner", 1)).toEqual(["east", "south"]);
    expect(getPipesNeighbor(0, "north")).toBeNull();
    expect(getPipesNeighbor(0, "east")).toBe(1);
    expect(rotatePipesTile([0, 1, 2], 1)).toEqual([0, 2, 2]);
  });

  it("rejects malformed boards and answers", () => {
    expect(isValidPipesConfiguration({ ...question, source: 25 })).toBe(false);
    expect(
      isValidPipesConfiguration({
        ...question,
        solutionRotations: question.solutionRotations.slice(1),
      }),
    ).toBe(false);
    expect(isPipesAnswer({ rotations: question.initialRotations, moves: -1 })).toBe(false);
    expect(isPipesAnswer({ rotations: question.initialRotations.slice(1), moves: 1 })).toBe(false);
  });

  it("awards speed points only for a complete network and retains timeout progress", () => {
    expect(
      evaluateAnswer({
        question,
        answer: { rotations: question.solutionRotations, moves: 12 },
        timeUsed: 0,
      }),
    ).toMatchObject({
      status: "correct",
      isCorrect: true,
      points: 150,
      details: { type: "pipes", connectedTiles: 25, solved: true },
    });

    expect(
      evaluateAnswer({
        question,
        answer: { rotations: question.initialRotations, moves: 4 },
        timeUsed: question.timeLimit,
        timedOut: true,
      }),
    ).toMatchObject({
      status: "partial",
      isCorrect: false,
      points: 0,
      details: { type: "pipes", moves: 4, solved: false },
    });
  });
});
