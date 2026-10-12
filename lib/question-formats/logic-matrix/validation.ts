import { isValidLogicMatrixPublicPayload } from "@/lib/scoringCore/questions/logicMatrix";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  logicMatrixPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const validPublicPayload = isValidLogicMatrixPublicPayload({
      pieces: publicPayload.pieces,
      cells: publicPayload.cells,
      optionIds: publicPayload.optionIds,
      showPieceLabels: publicPayload.showPieceLabels,
    });
    const optionIds = publicPayload.optionIds;
    if (!hasOnlyKeys(publicPayload, logicMatrixPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validPublicPayload) throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(optionIds)) throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["logic-matrix"]["publicPayload"];
  });
}
