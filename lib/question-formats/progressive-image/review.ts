import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "progressive-image" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"progressive-image"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    typeof solution.correctAnswer !== "string" ||
    !Array.isArray(solution.acceptedAnswers) ||
    !solution.acceptedAnswers.every((answer) => typeof answer === "string") ||
    typeof solution.solutionAlt !== "string"
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "progressive-image",
    category: question.category,
    tags: question.tags,
    question: question.question,
    surface: question.surface,
    revealDuration: question.revealDuration,
    answerLabel: question.answerLabel ?? undefined,
    answerPlaceholder: question.answerPlaceholder ?? undefined,
    correctAnswer: solution.correctAnswer,
    acceptedAnswers: solution.acceptedAnswers,
    solutionAlt: solution.solutionAlt,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
