import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  nonEmptyString,
  shortTextPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    if (context.payloadSchemaVersion !== 1)
      throw new FormatValidationError("invalid_question_payload");
    if (!hasOnlyKeys(publicPayload, shortTextPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (
      publicPayload.answerPlaceholder !== undefined &&
      publicPayload.answerPlaceholder !== null &&
      !nonEmptyString(publicPayload.answerPlaceholder, 200)
    )
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["short-text"]["publicPayload"];
  });
}
