import { describe, expect, it } from "vitest";
import { challengeDefinitions } from "@/data/challengeDefinitions";
import {
  getChallengeById,
  getPyramidQuestionIds,
  validatePyramidChallengeDefinition,
} from "@/data/challenges";
import { questionsById } from "@/data/questions";
import { withPyramidScoring } from "@/lib/challengeScoring";
import {
  isValidErrorReconstructionConfiguration,
  isValidLogicMatrixConfiguration,
} from "@/lib/scoring";
import { countQueensSolutions, isValidQueensConfiguration } from "@/lib/queens";

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

  it("keeps the advanced puzzle configurations valid and unique", () => {
    const matrix = questionsById["pyramid-shape-direction-matrix"];
    const error = questionsById["pyramid-algebra-error"];
    const code = questionsById["pyramid-secret-code"];
    const queens = questionsById["pyramid-summit-queens"];
    expect(isValidLogicMatrixConfiguration(matrix)).toBe(true);
    expect(isValidErrorReconstructionConfiguration(error)).toBe(true);
    expect(code.correctAnswer).toBe("507");
    expect(isValidQueensConfiguration(queens)).toBe(true);
    expect(countQueensSolutions(queens)).toBe(1);
  });
});
