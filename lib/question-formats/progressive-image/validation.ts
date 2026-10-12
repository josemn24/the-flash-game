import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import { isAuthorizedImageSurface } from "../public-common";
import {
  hasOnlyKeys,
  isProgressiveImageSurface,
  nonEmptyString,
  progressiveImagePublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const validRevealDuration =
      Number.isSafeInteger(publicPayload.revealDurationMs) &&
      (publicPayload.revealDurationMs as number) > 0 &&
      (publicPayload.revealDurationMs as number) < (context.timeLimitMs as number);
    if (!hasOnlyKeys(publicPayload, progressiveImagePublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (
      !(context.publicRepresentation === "authorized-runtime"
        ? isAuthorizedImageSurface(publicPayload.surface)
        : isProgressiveImageSurface(publicPayload.surface, context.payloadSchemaVersion))
    )
      throw new FormatValidationError("invalid_question_payload");
    if (!validRevealDuration) throw new FormatValidationError("invalid_question_payload");
    if (
      publicPayload.answerLabel !== undefined &&
      publicPayload.answerLabel !== null &&
      !nonEmptyString(publicPayload.answerLabel, 200)
    )
      throw new FormatValidationError("invalid_question_payload");
    if (
      publicPayload.answerPlaceholder !== undefined &&
      publicPayload.answerPlaceholder !== null &&
      !nonEmptyString(publicPayload.answerPlaceholder, 200)
    )
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["progressive-image"]["publicPayload"];
  });
}
