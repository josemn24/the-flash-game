import { isValidZipPublicConfiguration } from "@/lib/zip";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  nonEmptyString,
  storedPublicEnvelope,
  zipPublicPayloadKeys,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const configuration = {
      grid: publicPayload.grid,
      checkpoints: publicPayload.checkpoints,
    };
    const validPresentation = ["instruction", "mapNote", "boardLabel"].every(
      (key) => publicPayload[key] === undefined || nonEmptyString(publicPayload[key], 500),
    );
    if (!hasOnlyKeys(publicPayload, zipPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (context.payloadSchemaVersion !== 1)
      throw new FormatValidationError("invalid_question_payload");
    if (!isValidZipPublicConfiguration(configuration))
      throw new FormatValidationError("invalid_question_payload");
    if (!validPresentation) throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["zip"]["publicPayload"];
  });
}
