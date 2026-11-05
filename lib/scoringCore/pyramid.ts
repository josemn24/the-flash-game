import { QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS } from "@/lib/queens";
import type { AnswerValue } from "@/types/contracts";
import type { AnswerResult } from "@/types/gameplay/result";

export function pyramidNullEvaluation(
  answer: AnswerValue | null,
): Pick<AnswerResult, "status" | "points" | "details"> | undefined {
  return answer === null ? { status: "unanswered" as const, points: 0 } : undefined;
}

/** Mode consequences shared with the server; authorization and receipts stay outside. */
export function pyramidEvaluation(
  result: Pick<AnswerResult, "status" | "points" | "details">,
  timedOut: boolean,
  incorrectValidations: number,
): Pick<AnswerResult, "status" | "points" | "details"> {
  if (
    !timedOut &&
    result.details?.type === "queens" &&
    !result.details.solved &&
    incorrectValidations >= QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS
  ) {
    return {
      status: "incorrect",
      points: 0,
      details: { ...result.details, failureReason: "attempts_exhausted" },
    };
  }
  return result;
}
