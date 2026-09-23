import type { AnswerResult } from "@/types/game";
import { isPyramidLevelPassed, normalizePyramidResult } from "@/features/pyramid/pyramidAttempt";

export type CompetitivePyramidOutcome = "in_progress" | "failed" | "summit";

export type CompetitivePyramidProgress = {
  readonly reachedLevelCount: number;
  readonly levelsCleared: number;
  readonly score: number;
  readonly outcome: CompetitivePyramidOutcome;
};

/** Rebuilds official Pyramid progress from ordered, server-evaluated answers. */
export function deriveCompetitivePyramidProgress(
  totalLevels: number,
  answers: readonly AnswerResult[],
): CompetitivePyramidProgress {
  const reached = answers.slice(0, totalLevels);
  const failed = reached.some((answer) => !isPyramidLevelPassed(answer));
  const levelsCleared = reached.filter(isPyramidLevelPassed).length;
  const score = reached.reduce((sum, answer) => sum + normalizePyramidResult(answer).points, 0);
  const outcome: CompetitivePyramidOutcome = failed
    ? "failed"
    : levelsCleared === totalLevels
      ? "summit"
      : "in_progress";

  return { reachedLevelCount: reached.length, levelsCleared, score, outcome };
}
