import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "multiple-choice" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"multiple-choice"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  return {
    id: question.id,
    type: "multiple-choice",
    category: question.category,
    tags: question.tags,
    question: question.question,
    options: [...question.options],
    timeLimit: question.timeLimit,
    points: question.points,
    ...(typeof solution.correctAnswer === "string"
      ? { correctAnswer: solution.correctAnswer }
      : { correctAnswer: "" }),
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
