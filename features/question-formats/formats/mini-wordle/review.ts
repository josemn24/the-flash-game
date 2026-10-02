import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "mini-wordle" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"mini-wordle"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
  return {
    id: question.id,
    type: "mini-wordle",
    category: question.category,
    tags: question.tags,
    question: question.question,
    hint: question.hint ?? undefined,
    wordLength: question.wordLength,
    maxAttempts: question.maxAttempts,
    correctAnswer: solution.correctAnswer,
    additionalGuesses: Array.isArray(solution.additionalGuesses)
      ? solution.additionalGuesses.filter((guess): guess is string => typeof guess === "string")
      : [],
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
