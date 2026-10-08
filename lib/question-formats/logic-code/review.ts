import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
import type { AnswerResult } from "@/types/gameplay/result";

/** Older evaluations omitted the code history but retained the final answer and failed count. */
export function logicCodeReviewResult(result: AnswerResult) {
  const details = result.details?.type === "logic-code" ? result.details : undefined;
  const submittedCodes = details?.submittedCodes.length
    ? details.submittedCodes
    : typeof result.answer === "string" && result.answer.length > 0
      ? [result.answer]
      : [];
  const attemptCount = Math.max(
    submittedCodes.length,
    (details?.incorrectAttempts ?? 0) + (result.status === "correct" ? 1 : 0),
  );
  return { submittedCodes, attemptCount };
}

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
