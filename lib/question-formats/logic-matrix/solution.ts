import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import { isValidLogicMatrixPublicPayload } from "@/lib/scoringCore/questions/logicMatrix";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { LogicMatrixQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"logic-matrix"> {
  const matrixPayload = {
    pieces: publicPayload.pieces,
    cells: publicPayload.cells,
    optionIds: publicPayload.optionIds,
    ...(publicPayload.showPieceLabels !== undefined
      ? { showPieceLabels: publicPayload.showPieceLabels }
      : {}),
  };
  const correctOptionId = solutionPayload.correctOptionId;
  if (
    !isValidLogicMatrixPublicPayload(matrixPayload) ||
    typeof correctOptionId !== "string" ||
    !matrixPayload.optionIds.includes(correctOptionId)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "logic-matrix",
    pieces: matrixPayload.pieces,
    cells: matrixPayload.cells,
    optionIds: matrixPayload.optionIds,
    correctOptionId,
    showPieceLabels:
      typeof matrixPayload.showPieceLabels === "boolean" ? matrixPayload.showPieceLabels : true,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies LogicMatrixQuestion;
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
