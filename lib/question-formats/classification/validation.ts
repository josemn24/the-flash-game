import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  CLASSIFICATION_MAX_CATEGORIES,
  CLASSIFICATION_MAX_ITEMS,
  CLASSIFICATION_MIN_CATEGORIES,
  CLASSIFICATION_MIN_ITEMS,
  classificationPublicPayloadKeys,
  hasExactKeys,
  hasOnlyKeys,
  isRecord,
  nonEmptyString,
  storedPublicEnvelope,
  type StoredPublicContext,
} from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";

export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const items = publicPayload.items;
    const categories = publicPayload.categories;
    const validItems =
      Array.isArray(items) &&
      items.length >= CLASSIFICATION_MIN_ITEMS &&
      items.length <= CLASSIFICATION_MAX_ITEMS &&
      items.every(
        (item) =>
          isRecord(item) && hasExactKeys(item, ["label"]) && nonEmptyString(item.label, 500),
      );
    const validCategories =
      Array.isArray(categories) &&
      categories.length >= CLASSIFICATION_MIN_CATEGORIES &&
      categories.length <= CLASSIFICATION_MAX_CATEGORIES &&
      categories.every((category) => nonEmptyString(category, 120));
    const labels = validItems
      ? items.map((item) => (item as Record<string, unknown>).label as string)
      : [];
    const categoryValues = validCategories ? categories : [];
    if (!hasOnlyKeys(publicPayload, classificationPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validItems) throw new FormatValidationError("invalid_question_payload");
    if (new Set(labels).size !== labels.length)
      throw new FormatValidationError("invalid_question_payload");
    if (!validCategories) throw new FormatValidationError("invalid_question_payload");
    if (new Set(categoryValues).size !== categoryValues.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["classification"]["publicPayload"];
  });
}
