import { isValidEstimationAnswer, isValidEstimationSolution } from "@/lib/estimation";
import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { EstimationQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "estimation" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"estimation"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const tolerance = solution.tolerance;
  if (
    !isValidEstimationSolution(solution.correctAnswer, tolerance, question) ||
    typeof tolerance !== "number" ||
    !isValidEstimationAnswer(question.initialValue, question)
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "estimation",
    category: question.category,
    tags: question.tags,
    question: question.question,
    min: question.min,
    max: question.max,
    step: question.step,
    initialValue: question.initialValue,
    unit: question.unit,
    ...(question.media ? { media: question.media } : {}),
    correctAnswer: solution.correctAnswer,
    tolerance,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies EstimationQuestion;
}
