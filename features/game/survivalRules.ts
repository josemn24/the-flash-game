import type { AnswerResult } from "@/types/game";

export function isSurvivalMistake(result: Pick<AnswerResult, "status">) {
  return result.status === "incorrect" || result.status === "unanswered";
}

export function getSurvivalLivesAfterResult(
  livesRemaining: number,
  result: Pick<AnswerResult, "status">,
) {
  return isSurvivalMistake(result) ? Math.max(0, livesRemaining - 1) : livesRemaining;
}

export function getSurvivalReachedQuestionCount(resultsCount: number) {
  return resultsCount;
}
