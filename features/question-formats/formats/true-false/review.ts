import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "true-false" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"true-false"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "boolean") {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "true-false",
    category: question.category,
    tags: question.tags,
    question: question.question,
    correctAnswer: solution.correctAnswer,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
