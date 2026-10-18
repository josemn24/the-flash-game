import { describe, expect, it } from "vitest";
import {
  deriveCompetitivePyramidProgress,
  isPyramidLevelPassed,
  normalizePyramidResult,
} from "@/lib/gameplay/pyramidProgress";
import type { AnswerResult } from "@/types/gameplay";

function answer(index: number, status: AnswerResult["status"], points = 10): AnswerResult {
  return {
    questionId: `level-${index}`,
    answer: index,
    status,
    isCorrect: status === "correct",
    points,
    timeUsed: 1,
  };
}

describe("competitive Pyramid progress", () => {
  it("starts with no reached levels, points or terminal outcome", () => {
    expect(deriveCompetitivePyramidProgress(7, [])).toEqual({
      reachedLevelCount: 0,
      levelsCleared: 0,
      score: 0,
      outcome: "in_progress",
    });
  });

  it("awards summit only after all seven levels are correct", () => {
    const points = [14, 14, 14, 14, 14, 15, 15];
    const progress = deriveCompetitivePyramidProgress(
      7,
      points.map((value, index) => answer(index, "correct", value)),
    );

    expect(progress).toEqual({
      reachedLevelCount: 7,
      levelsCleared: 7,
      score: 100,
      outcome: "summit",
    });
  });

  it.each(["incorrect", "partial", "unanswered"] as const)(
    "ends as failed on a %s in the first or an intermediate level",
    (status) => {
      const early = deriveCompetitivePyramidProgress(7, [answer(0, status, 8)]);
      const intermediate = deriveCompetitivePyramidProgress(7, [
        answer(0, "correct"),
        answer(1, "correct"),
        answer(2, status, 8),
      ]);

      expect(early.outcome).toBe("failed");
      expect(early.score).toBe(0);
      expect(intermediate).toMatchObject({
        reachedLevelCount: 3,
        levelsCleared: 2,
        score: 20,
        outcome: "failed",
      });
    },
  );

  it("keeps a correctly resolved level in progress until the next briefing is played", () => {
    expect(deriveCompetitivePyramidProgress(7, [answer(0, "correct")])).toMatchObject({
      reachedLevelCount: 1,
      levelsCleared: 1,
      score: 10,
      outcome: "in_progress",
    });
  });

  // PYR-04: reaching a level is distinct from clearing it; even a partial with
  // a positive format score must end the ascent and preserve only earlier points.
  describe.each([
    { failedIndex: 0, previousPoints: 0 },
    { failedIndex: 3, previousPoints: 42 },
    { failedIndex: 6, previousPoints: 85 },
  ])("failure at level $failedIndex (zero-based)", ({ failedIndex, previousPoints }) => {
    it.each(["incorrect", "partial", "unanswered"] as const)(
      "ends on %s without crediting the failed level",
      (status) => {
        const weights = [14, 14, 14, 14, 14, 15, 15];
        const results = weights
          .slice(0, failedIndex)
          .map((points, index) => answer(index, "correct", points));
        results.push(answer(failedIndex, status, weights[failedIndex]));

        expect(deriveCompetitivePyramidProgress(7, results)).toEqual({
          reachedLevelCount: failedIndex + 1,
          levelsCleared: failedIndex,
          score: previousPoints,
          outcome: "failed",
        });
      },
    );
  });

  it("does not infer summit from reaching the last level or collecting points alone", () => {
    const results = Array.from({ length: 6 }, (_, index) => answer(index, "correct", 0));
    expect(deriveCompetitivePyramidProgress(7, results)).toMatchObject({
      levelsCleared: 6,
      score: 0,
      outcome: "in_progress",
    });
    expect(deriveCompetitivePyramidProgress(7, [...results, answer(6, "correct", 0)])).toEqual({
      reachedLevelCount: 7,
      levelsCleared: 7,
      score: 0,
      outcome: "summit",
    });
  });

  it("requires a fully correct status and confirmation to clear a level", () => {
    expect(isPyramidLevelPassed({ status: "partial", isCorrect: true })).toBe(false);
    expect(isPyramidLevelPassed({ status: "correct", isCorrect: false })).toBe(false);
    expect(isPyramidLevelPassed({ status: "correct", isCorrect: true })).toBe(true);
  });

  it("normalizes failed points without rewriting the original format evaluation", () => {
    const partial = Object.freeze({ ...answer(2, "partial", 8), isCorrect: true });
    const earlier = Object.freeze(answer(1, "correct", 12));
    const results = Object.freeze([earlier, partial]);

    expect(normalizePyramidResult(partial)).toEqual({ ...partial, points: 0 });
    expect(deriveCompetitivePyramidProgress(7, results)).toMatchObject({
      score: 12,
      outcome: "failed",
    });
    expect(partial.points).toBe(8);
    expect(earlier.points).toBe(12);
  });
});
