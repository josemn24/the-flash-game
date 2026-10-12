import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "short-text" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"short-text"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    typeof solution.correctAnswer !== "string" ||
    !Array.isArray(solution.acceptedAnswers) ||
    !solution.acceptedAnswers.every((answer) => typeof answer === "string")
  )
    throw new ServerFlashQuestionError();
  return {
    ...question,
    correctAnswer: solution.correctAnswer,
    acceptedAnswers: solution.acceptedAnswers,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
