import { QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS } from "@/lib/queens";
import type { AnswerValue } from "@/types/contracts";
import { isPyramidDraftAnswer, timeoutPartialPoints } from "@/lib/gameplay/pyramidPartialCredit";
import { calculateMatchingMetrics } from "./questions/matching";
import { calculateClassificationMetrics } from "./questions/classification";
import { calculateOrderingMetrics } from "./questions/ordering";
import { calculateSpeedMultiplier } from "./shared";
import type { ResolvedQuestion } from "@/types/gameplay/scoring";
import type { PyramidDraftReviewState } from "@/types/gameplay/result";
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

export function pyramidDraftSnapshot(
  question: ResolvedQuestion,
  answer: unknown,
  complete: boolean,
): PyramidDraftReviewState | undefined {
  if (!isPyramidDraftAnswer(answer)) return undefined;
  if (question.type === "ordering") {
    if (
      Array.isArray(answer) &&
      answer.length === question.items.length &&
      new Set(answer).size === answer.length &&
      answer.every((item) => question.items.includes(item))
    )
      return { type: "ordering", answer };
    return undefined;
  }
  if (Array.isArray(answer)) return undefined;
  if (question.type === "classification") {
    const entries = Object.entries(answer);
    if (
      (!complete || entries.length === question.items.length) &&
      entries.every(
        ([label, category]) =>
          question.items.some((item) => item.label === label) &&
          question.categories.includes(category),
      )
    )
      return { type: "classification", answer };
    return undefined;
  }
  if (question.type === "matching") {
    const entries = Object.entries(answer);
    if (
      (!complete || entries.length === question.leftItems.length) &&
      new Set(Object.values(answer)).size === entries.length &&
      entries.every(
        ([left, right]) =>
          question.leftItems.some((item) => item.id === left) &&
          question.rightItems.some((item) => item.id === right),
      )
    )
      return { type: "matching", answer };
  }
  return undefined;
}

export function evaluatePyramidDraft(
  question: ResolvedQuestion,
  snapshot: PyramidDraftReviewState | undefined,
  timeUsedMs: number,
  timedOut: boolean,
): Pick<AnswerResult, "status" | "points" | "details"> {
  const details = pyramidDraftDetails(question, snapshot);
  if (!details) return { status: "unanswered", points: 0 };
  const [correct, total] =
    details.type === "matching"
      ? [details.correctPairs, details.totalPairs]
      : [details.correctItems, details.totalItems];
  if (correct === total) {
    return {
      status: "correct",
      points: Math.round(
        question.points * calculateSpeedMultiplier(timeUsedMs / 1000, question.timeLimit),
      ),
      details,
    };
  }
  const points = timeoutPartialPoints(question.points, correct, total);
  if (points > 0)
    return {
      status: "partial",
      points,
      details: { ...details, pyramidPartialCredit: timedOut ? "timeout" : "submission" },
    };
  return { status: timedOut ? "unanswered" : "incorrect", points: 0, details };
}

function pyramidDraftDetails(
  question: ResolvedQuestion,
  snapshot: PyramidDraftReviewState | undefined,
) {
  if (question.type === "matching" && snapshot?.type === "matching")
    return { type: question.type, ...calculateMatchingMetrics(question, snapshot.answer) };
  if (question.type === "classification" && snapshot?.type === "classification")
    return { type: question.type, ...calculateClassificationMetrics(question, snapshot.answer) };
  if (question.type === "ordering" && snapshot?.type === "ordering")
    return { type: question.type, ...calculateOrderingMetrics(question, snapshot.answer) };
  return undefined;
}
