import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "odd-one-out" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"odd-one-out"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "string") {
    throw new ServerFlashQuestionError();
  }
  if (!question.items.some((item) => item.id === solution.correctAnswer)) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "odd-one-out",
    category: question.category,
    tags: question.tags,
    question: question.question,
    items: [...question.items],
    correctAnswer: solution.correctAnswer,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
