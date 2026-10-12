import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  MATCHING_MAX_PAIRS,
  MATCHING_MIN_PAIRS,
  hasOnlyKeys,
  isMatchingItem,
  matchingPublicPayloadKeys,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const leftItems = publicPayload.leftItems;
    const rightItems = publicPayload.rightItems;
    const validLeftItems =
      Array.isArray(leftItems) &&
      leftItems.length >= MATCHING_MIN_PAIRS &&
      leftItems.length <= MATCHING_MAX_PAIRS &&
      leftItems.every(isMatchingItem);
    const validRightItems =
      Array.isArray(rightItems) &&
      Array.isArray(leftItems) &&
      rightItems.length === leftItems.length &&
      rightItems.every(isMatchingItem);
    const normalizedLeftLabels = validLeftItems
      ? leftItems.map((item) => normalizeAnswer(item.label))
      : [];
    const normalizedRightLabels = validRightItems
      ? rightItems.map((item) => normalizeAnswer(item.label))
      : [];
    if (!hasOnlyKeys(publicPayload, matchingPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validLeftItems) throw new FormatValidationError("invalid_question_payload");
    if (!validRightItems) throw new FormatValidationError("invalid_question_payload");
    if (new Set(normalizedLeftLabels).size !== normalizedLeftLabels.length)
      throw new FormatValidationError("invalid_question_payload");
    if (new Set(normalizedRightLabels).size !== normalizedRightLabels.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["matching"]["publicPayload"];
  });
}
