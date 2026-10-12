import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import { storedPublicEnvelope, type StoredPublicContext } from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    if (publicPayload.requireFullCoverage !== true)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["connect-pairs"]["publicPayload"];
  });
}
