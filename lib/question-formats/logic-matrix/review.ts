import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { LogicMatrixQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "logic-matrix" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"logic-matrix"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    typeof solution.correctOptionId !== "string" ||
    !question.optionIds.includes(solution.correctOptionId)
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "logic-matrix",
    category: question.category,
    tags: question.tags,
    question: question.question,
    pieces: [...question.pieces],
    cells: [...question.cells],
    optionIds: [...question.optionIds],
    correctOptionId: solution.correctOptionId,
    showPieceLabels: question.showPieceLabels,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies LogicMatrixQuestion;
}
