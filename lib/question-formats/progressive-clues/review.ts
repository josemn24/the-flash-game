import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "progressive-clues" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"progressive-clues"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (typeof solution.correctAnswer !== "string") throw new ServerFlashQuestionError();
  return {
    id: question.id,
    type: "progressive-clues",
    category: question.category,
    tags: question.tags,
    question: question.question,
    clues: [...question.clues],
    cluePenalty: question.cluePenalty,
    correctAnswer: solution.correctAnswer,
    acceptedAnswers: Array.isArray(solution.acceptedAnswers)
      ? solution.acceptedAnswers.filter((answer): answer is string => typeof answer === "string")
      : undefined,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
