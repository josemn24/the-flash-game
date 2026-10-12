import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "anagram" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"anagram"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "string") {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "anagram",
    category: question.category,
    tags: question.tags,
    question: question.question,
    tiles: [...question.tiles],
    hint: question.hint ?? undefined,
    correctAnswer: solution.correctAnswer,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
