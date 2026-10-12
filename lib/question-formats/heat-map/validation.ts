import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import { isAuthorizedImageSurface } from "../public-common";
import {
  hasOnlyKeys,
  heatMapPublicPayloadKeys,
  isPrivateImageSurface,
  nonEmptyString,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
import { readPublic } from "./public";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    if (context.profile === "published" && context.payloadSchemaVersion === 1) {
      readPublic({
        id: "stored-validation",
        payload: input,
        timeLimitMs: context.timeLimitMs,
        points: 100,
      });
      return publicPayload as StoredQuestionMap["heat-map"]["publicPayload"];
    }
    if (!hasOnlyKeys(publicPayload, heatMapPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (context.payloadSchemaVersion !== 2)
      throw new FormatValidationError("invalid_question_payload");
    if (
      !(context.publicRepresentation === "authorized-runtime"
        ? isAuthorizedImageSurface(publicPayload.surface)
        : isPrivateImageSurface(publicPayload.surface))
    )
      throw new FormatValidationError("invalid_question_payload");
    if (!nonEmptyString(publicPayload.targetLabel, 500))
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["heat-map"]["publicPayload"];
  });
}
