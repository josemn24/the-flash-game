import type { AnswerResult, QuestionType } from "@/types/game";

type SurvivalMistakeResult = Pick<AnswerResult, "details"> & {
  readonly status: AnswerResult["status"] | "timeout";
};

export type SurvivalOutcome = "in_progress" | "eliminated" | "survived";

export type SurvivalProgress = {
  readonly livesRemaining: number;
  readonly reachedQuestionCount: number;
  readonly outcome: SurvivalOutcome;
};

export function isSurvivalMistake(result: SurvivalMistakeResult) {
  if (
    result.status === "incorrect" ||
    result.status === "unanswered" ||
    result.status === "timeout"
  ) {
    return true;
  }

  return (
    (result.details?.type === "matching" || result.details?.type === "queens") &&
    result.details.incorrectAttempts > 0
  );
}

export function getSurvivalLivesAfterResult(livesRemaining: number, result: SurvivalMistakeResult) {
  return isSurvivalMistake(result) ? Math.max(0, livesRemaining - 1) : livesRemaining;
}

export function shouldEliminateAfterIncorrectAttempt(
  questionType: QuestionType | undefined,
  livesRemaining: number,
) {
  return questionType === "matching" && livesRemaining === 1;
}

export function getSurvivalReachedQuestionCount(resultsCount: number) {
  return resultsCount;
}

/** Rebuild official progress from evaluated, persisted answer results. */
export function deriveSurvivalProgress(
  initialLives: number,
  totalQuestions: number,
  results: readonly SurvivalMistakeResult[],
): SurvivalProgress {
  const reachedQuestionCount = Math.min(results.length, totalQuestions);
  const livesRemaining = results.reduce(
    (lives, result) => getSurvivalLivesAfterResult(lives, result),
    initialLives,
  );
  const outcome: SurvivalOutcome =
    livesRemaining === 0
      ? "eliminated"
      : reachedQuestionCount >= totalQuestions
        ? "survived"
        : "in_progress";
  return { livesRemaining, reachedQuestionCount, outcome };
}
