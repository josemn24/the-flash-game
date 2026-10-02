import { definition } from "./definition";

import type { ServerLogicMatrixQuestion } from "@/types/gameplay/challenge";

import { isValidLogicMatrixPublicPayload } from "@/lib/scoringCore/questions/logicMatrix";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "logic-matrix" }> {
  const { value, base } = publicEnvelope(context, definition);
  const publicPayload = {
    pieces: value.pieces,
    cells: value.cells,
    optionIds: value.optionIds,
    ...(value.showPieceLabels !== undefined ? { showPieceLabels: value.showPieceLabels } : {}),
  };
  if (!isValidLogicMatrixPublicPayload(publicPayload)) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "logic-matrix",
    pieces: publicPayload.pieces,
    cells: publicPayload.cells,
    optionIds: publicPayload.optionIds,
    showPieceLabels:
      typeof publicPayload.showPieceLabels === "boolean" ? publicPayload.showPieceLabels : true,
  } satisfies ServerLogicMatrixQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
