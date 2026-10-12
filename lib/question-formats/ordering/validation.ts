import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  ORDERING_MAX_ITEMS,
  ORDERING_MIN_ITEMS,
  hasExactKeys,
  hasOnlyKeys,
  isRecord,
  nonEmptyString,
  orderingPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const items = publicPayload.items;
    const validItems =
      Array.isArray(items) &&
      items.length >= ORDERING_MIN_ITEMS &&
      items.length <= ORDERING_MAX_ITEMS &&
      items.every((item) => nonEmptyString(item, 500));
    const validDirectionLabels =
      publicPayload.directionLabels === undefined ||
      publicPayload.directionLabels === null ||
      (isRecord(publicPayload.directionLabels) &&
        hasExactKeys(publicPayload.directionLabels, ["start", "end"]) &&
        nonEmptyString(publicPayload.directionLabels.start, 120) &&
        nonEmptyString(publicPayload.directionLabels.end, 120));
    if (!hasOnlyKeys(publicPayload, orderingPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validItems) throw new FormatValidationError("invalid_question_payload");
    if (new Set(items).size !== items.length)
      throw new FormatValidationError("invalid_question_payload");
    if (!validDirectionLabels) throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["ordering"]["publicPayload"];
  });
}
