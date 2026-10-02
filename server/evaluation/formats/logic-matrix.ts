import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"logic-matrix">;
  const { solution, points } = input;
  const logicMatrixSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, logicMatrixSolution, points),
    type: publicQuestion.type,
    pieces: [...publicQuestion.payload.pieces],
    cells: [...publicQuestion.payload.cells],
    optionIds: [...publicQuestion.payload.optionIds],
    correctOptionId: logicMatrixSolution.payload.correctOptionId,
    ...(publicQuestion.payload.showPieceLabels === null
      ? {}
      : { showPieceLabels: publicQuestion.payload.showPieceLabels }),
  } satisfies ResolvedQuestionOfType<"logic-matrix">;
}
