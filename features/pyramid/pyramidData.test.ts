import { describe, expect, it } from "vitest";
import { challengeDefinitions } from "@/data/challengeDefinitions";
import {
  getChallengeById,
  getPyramidQuestionIds,
  validatePyramidChallengeDefinition,
} from "@/data/challenges";
import { questionsById } from "@/data/questions";
import { withPyramidScoring } from "@/lib/challengeScoring";
import { calculateConnectPairsMetrics, isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import { evaluateAnswer, isValidLogicMatrixConfiguration } from "@/lib/scoring";
import { countQueensSolutions, isValidQueensConfiguration } from "@/lib/queens";
import { normalizePyramidResult } from "@/features/pyramid/pyramidAttempt";

describe("La Pirámide: Cumbre lógica", () => {
  it("defines seven unique levels worth exactly 100 points", () => {
    const definition = challengeDefinitions["pyramid-logic-definition"];
    expect(() => validatePyramidChallengeDefinition(definition)).not.toThrow();
    expect(definition.levels).toHaveLength(7);
    expect(new Set(getPyramidQuestionIds(definition))).toHaveProperty("size", 7);
    expect(Object.values(definition.questionPoints).reduce((sum, points) => sum + points, 0)).toBe(
      100,
    );
  });

  it("resolves the published challenge and applies its increasing point values", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    expect(withPyramidScoring(challenge).levels.map((level) => level.question.points)).toEqual([
      7, 9, 11, 14, 16, 19, 24,
    ]);
  });

  it("keeps the advanced puzzle configurations valid", () => {
    const matrix = questionsById["pyramid-shape-direction-matrix"];
    const trap = questionsById["pyramid-connect-pairs-trap"];
    const code = questionsById["pyramid-secret-code"];
    const queens = questionsById["pyramid-summit-queens"];
    expect(isValidLogicMatrixConfiguration(matrix)).toBe(true);
    expect(matrix.showPieceLabels).toBe(false);
    expect(trap.pairs).toHaveLength(4);
    expect(new Set(trap.pairs.flatMap((pair) => pair.endpoints))).toHaveProperty("size", 8);
    expect(isValidConnectPairsConfiguration(trap)).toBe(true);
    expect(calculateConnectPairsMetrics(trap, { paths: trap.solutionPaths })).toMatchObject({
      connectedPairs: 4,
      coveredCells: 25,
      conflicts: 0,
      exact: true,
    });
    expect(code.correctAnswer).toBe("507");
    expect(queens.prefilledQueens).toEqual([2]);
    expect(queens.solution).toEqual(expect.arrayContaining(queens.prefilledQueens ?? []));
    expect(isValidQueensConfiguration(queens)).toBe(true);
    expect(countQueensSolutions(queens)).toBe(1);
  });

  it("ends the ascent on a partial trap submission and passes only complete coverage", () => {
    const challenge = getChallengeById("tabarnia-challenge-05");
    expect(challenge?.mode).toBe("pyramid");
    if (challenge?.mode !== "pyramid") throw new Error("Expected pyramid challenge");
    const trap = withPyramidScoring(challenge).levels[4]?.question;
    if (trap?.type !== "connect-pairs") throw new Error("Expected connect-pairs trap");

    const complete = evaluateAnswer({
      question: trap,
      answer: { paths: trap.solutionPaths },
      timeUsed: 5,
    });
    const partial = evaluateAnswer({
      question: trap,
      answer: { paths: { circle: trap.solutionPaths.circle } },
      timeUsed: 5,
    });
    const timedOut = evaluateAnswer({
      question: trap,
      answer: { paths: { circle: trap.solutionPaths.circle } },
      timeUsed: trap.timeLimit,
      timedOut: true,
    });

    expect(complete).toMatchObject({ status: "correct", isCorrect: true });
    expect(partial).toMatchObject({ status: "partial", isCorrect: false });
    expect(timedOut).toMatchObject({ status: "partial", isCorrect: false });
    expect(normalizePyramidResult(partial).points).toBe(0);
    expect(normalizePyramidResult(timedOut).points).toBe(0);
  });
});
