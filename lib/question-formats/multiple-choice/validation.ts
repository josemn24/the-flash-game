import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  hasOnlyKeys,
  isMedia,
  isPrivateMultipleChoiceMedia,
  isPromptVisual,
  isRecord,
  multipleChoicePublicPayloadKeys,
  nonEmptyString,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const options = publicPayload.options;
    if (!hasOnlyKeys(publicPayload, multipleChoicePublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(options)) throw new FormatValidationError("invalid_question_payload");
    if (options.length < 2) throw new FormatValidationError("invalid_question_payload");
    if (!options.every((option) => nonEmptyString(option, 500)))
      throw new FormatValidationError("invalid_question_payload");
    if (new Set(options).size !== options.length)
      throw new FormatValidationError("invalid_question_payload");
    const validMedia =
      context.payloadSchemaVersion === 2
        ? context.publicRepresentation === "authorized-runtime"
          ? isRecord(publicPayload.media) &&
            publicPayload.media.type === "image" &&
            isMedia(publicPayload.media)
          : isPrivateMultipleChoiceMedia(publicPayload.media)
        : isMedia(publicPayload.media);
    if (!validMedia) throw new FormatValidationError("invalid_question_payload");
    if (!isPromptVisual(publicPayload.promptVisual))
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["multiple-choice"]["publicPayload"];
  });
}
