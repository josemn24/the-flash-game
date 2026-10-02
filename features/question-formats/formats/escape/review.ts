import { isValidEscapeConfiguration } from "@/lib/escape";
import { ServerFlashQuestionError } from "@/lib/question-formats/public-common";
import type { ServerFlashQuestion, ServerFlashTerminalReview } from "@/types/gameplay/challenge";
import type { EscapeQuestion, PracticeQuestionOfType } from "@/types/gameplay/practice";
export function questionWithSolution(
  question: Extract<ServerFlashQuestion, { type: "escape" }>,
  row?: ServerFlashTerminalReview,
): PracticeQuestionOfType<"escape"> {
  const solution =
    row?.solutionPayload && typeof row.solutionPayload === "object"
      ? (row.solutionPayload as Record<string, unknown>)
      : {};
  const referenceSolution = solution.referenceSolution;
  const optimalMoves = solution.optimalMoves;
  if (
    !Array.isArray(referenceSolution) ||
    !Number.isSafeInteger(optimalMoves) ||
    !referenceSolution.every(
      (move) =>
        move &&
        typeof move === "object" &&
        !Array.isArray(move) &&
        typeof (move as Record<string, unknown>).blockId === "string" &&
        Number.isSafeInteger((move as Record<string, unknown>).from) &&
        Number.isSafeInteger((move as Record<string, unknown>).to),
    )
  ) {
    throw new ServerFlashQuestionError();
  }
  const fullQuestion = {
    id: question.id,
    type: "escape",
    category: question.category,
    tags: question.tags,
    question: question.question,
    grid: question.grid,
    initialBlocks: [...question.initialBlocks],
    referenceSolution: referenceSolution as EscapeQuestion["referenceSolution"],
    optimalMoves: optimalMoves as number,
    instruction: question.instruction ?? undefined,
    hideInstruction: question.hideInstruction,
    objectiveLabel: question.objectiveLabel ?? undefined,
    hideObjectiveLabel: question.hideObjectiveLabel,
    completionMessage: question.completionMessage ?? undefined,
    boardLabel: question.boardLabel ?? undefined,
    timeLimit: question.timeLimit,
    points: question.points,
    explanation: typeof solution.explanation === "string" ? solution.explanation : "",
  } satisfies EscapeQuestion;
  if (!isValidEscapeConfiguration(fullQuestion)) throw new ServerFlashQuestionError();
  return fullQuestion;
}
