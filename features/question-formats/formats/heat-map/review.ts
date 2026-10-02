import { isNormalizedPoint, isValidHeatMapRadii } from "@/lib/heatMap";
import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { HeatMapQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "heat-map" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"heat-map"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const target = solution.target;
  const fullCreditRadius = solution.fullCreditRadius;
  const toleranceRadius = solution.toleranceRadius;
  if (!isNormalizedPoint(target) || !isValidHeatMapRadii(fullCreditRadius, toleranceRadius)) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "heat-map",
    category: question.category,
    tags: question.tags,
    question: question.question,
    surface: question.surface,
    targetLabel: question.targetLabel,
    target,
    fullCreditRadius: fullCreditRadius as number,
    toleranceRadius: toleranceRadius as number,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies HeatMapQuestion;
}
