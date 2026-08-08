import type { AnswerResult, QuestionType } from "@/types/game";

type SurvivalMistakeResult = Pick<AnswerResult, "status" | "details">;

export function isSurvivalMistake(result: SurvivalMistakeResult) {
  if (result.status === "incorrect" || result.status === "unanswered") return true;

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
