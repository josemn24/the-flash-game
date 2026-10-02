import { isMiniWordleMaxAttempts, isMiniWordleWordLength } from "@/lib/miniWordle";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  miniWordlePublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const wordLength = publicPayload.wordLength;
    const maxAttempts = publicPayload.maxAttempts;
    if (!hasOnlyKeys(publicPayload, miniWordlePublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!isMiniWordleWordLength(wordLength))
      throw new FormatValidationError("invalid_question_payload");
    if (!isMiniWordleMaxAttempts(maxAttempts))
      throw new FormatValidationError("invalid_question_payload");
    if (
      publicPayload.hint !== undefined &&
      publicPayload.hint !== null &&
      typeof publicPayload.hint !== "string"
    )
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["mini-wordle"]["publicPayload"];
  });
}
