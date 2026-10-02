import { isValidEstimationConfiguration } from "@/lib/estimation";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  estimationPublicPayloadKeys,
  hasOnlyKeys,
  isMedia,
  isPrivateOptionalMedia,
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
      return publicPayload as StoredQuestionMap["estimation"]["publicPayload"];
    }
    const configuration = {
      min: publicPayload.min,
      max: publicPayload.max,
      step: publicPayload.step,
      initialValue: publicPayload.initialValue,
      unit: publicPayload.unit,
    };
    if (!hasOnlyKeys(publicPayload, estimationPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (context.payloadSchemaVersion !== 2)
      throw new FormatValidationError("invalid_question_payload");
    if (!isValidEstimationConfiguration(configuration))
      throw new FormatValidationError("invalid_question_payload");
    if (
      !(context.publicRepresentation === "authorized-runtime"
        ? publicPayload.media === null || isMedia(publicPayload.media)
        : isPrivateOptionalMedia(publicPayload.media))
    )
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["estimation"]["publicPayload"];
  });
}
