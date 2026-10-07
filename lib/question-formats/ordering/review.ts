import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "ordering" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"ordering"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    !Array.isArray(solution.correctOrder) ||
    solution.correctOrder.length !== question.items.length ||
    !solution.correctOrder.every((item) => question.items.includes(item)) ||
    new Set(solution.correctOrder).size !== solution.correctOrder.length
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "ordering",
    category: question.category,
    tags: question.tags,
    question: question.question,
    items: [...question.items],
    correctOrder: [...solution.correctOrder],
    directionLabels: question.directionLabels ?? undefined,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
