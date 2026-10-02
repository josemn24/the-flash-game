import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  PROGRESSIVE_CLUES_MAX_CLUES,
  PROGRESSIVE_CLUES_MAX_PENALTY,
  hasOnlyKeys,
  nonEmptyString,
  progressiveCluesPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const clues = publicPayload.clues;
    const cluePenalty = publicPayload.cluePenalty;
    if (!hasOnlyKeys(publicPayload, progressiveCluesPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(clues)) throw new FormatValidationError("invalid_question_payload");
    if (clues.length < 1) throw new FormatValidationError("invalid_question_payload");
    if (clues.length > PROGRESSIVE_CLUES_MAX_CLUES)
      throw new FormatValidationError("invalid_question_payload");
    if (!clues.every((clue) => nonEmptyString(clue, 500)))
      throw new FormatValidationError("invalid_question_payload");
    if (typeof cluePenalty !== "number")
      throw new FormatValidationError("invalid_question_payload");
    if (!Number.isSafeInteger(cluePenalty))
      throw new FormatValidationError("invalid_question_payload");
    if (cluePenalty < 0) throw new FormatValidationError("invalid_question_payload");
    if (cluePenalty > PROGRESSIVE_CLUES_MAX_PENALTY)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["progressive-clues"]["publicPayload"];
  });
}
