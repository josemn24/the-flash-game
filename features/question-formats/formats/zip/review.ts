import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import { isValidZipConfiguration } from "@/lib/zip";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { PracticeQuestionOfType, ZipQuestion } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "zip" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"zip"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  if (
    !Array.isArray(solution.solution) ||
    solution.solution.length !== 25 ||
    !solution.solution.every((cell) => Number.isSafeInteger(cell))
  ) {
    throw new ServerFlashQuestionError();
  }
  const fullQuestion = {
    id: question.id,
    type: "zip",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    checkpoints: [...question.checkpoints],
    solution: solution.solution as number[],
    instruction: question.instruction ?? undefined,
    mapNote: question.mapNote ?? undefined,
    boardLabel: question.boardLabel ?? undefined,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies ZipQuestion;
  if (!isValidZipConfiguration(fullQuestion)) throw new ServerFlashQuestionError();
  return fullQuestion;
}
