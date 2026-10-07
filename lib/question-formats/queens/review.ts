import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "queens" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"queens"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const solutionCells = solution.solution;
  const cellCount = question.grid.rows * question.grid.columns;
  if (
    !Array.isArray(solutionCells) ||
    solutionCells.length !== question.grid.rows ||
    !solutionCells.every((cell) => Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount)
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    id: question.id,
    type: "queens",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    regions: [...question.regions],
    prefilledQueens: [...question.prefilledQueens],
    solution: solutionCells,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  };
}
