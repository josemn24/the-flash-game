import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "logic-code" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"logic-code"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
  return {
    id: question.id,
    type: "logic-code",
    category: question.category,
    tags: question.tags,
    question: question.question,
    clues: [...question.clues],
    codeLength: question.codeLength,
    correctAnswer: solution.correctAnswer,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
