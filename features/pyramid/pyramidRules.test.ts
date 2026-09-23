import { describe, expect, it } from "vitest";
import { deriveCompetitivePyramidProgress } from "@/features/pyramid/pyramidRules";
import type { AnswerResult } from "@/types/game";

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
  it("awards summit only after all seven levels are correct", () => {
    const progress = deriveCompetitivePyramidProgress(
      7,
      Array.from({ length: 7 }, (_, index) => answer(index, "correct")),
    );

    expect(progress).toEqual({
      reachedLevelCount: 7,
      levelsCleared: 7,
      score: 70,
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
});
