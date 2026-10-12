import type {
  FlashEditorialClassificationQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  CLASSIFICATION_MAX_CATEGORIES,
  CLASSIFICATION_MAX_ITEMS,
  CLASSIFICATION_MIN_CATEGORIES,
  CLASSIFICATION_MIN_ITEMS,
  classificationSolutionKeys,
  FlashEditorialValidationError,
  hasExactKeys,
  hasOnlyKeys,
  isRecord,
  nonEmptyString,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "classification" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato classification.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, classificationSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato classification.`,
    ]);
  }
  const items = publicPayload.items;
  const categories = publicPayload.categories;
  const categoriesByItem = solutionPayload.categoriesByItem;
  const validItems =
    Array.isArray(items) &&
    items.length >= CLASSIFICATION_MIN_ITEMS &&
    items.length <= CLASSIFICATION_MAX_ITEMS &&
    items.every(
      (item) => isRecord(item) && hasExactKeys(item, ["label"]) && nonEmptyString(item.label, 500),
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
  const validSolution =
    isRecord(categoriesByItem) &&
    Object.keys(categoriesByItem).length === labels.length &&
    labels.every(
      (label) =>
        typeof categoriesByItem[label] === "string" &&
        categoryValues.includes(categoriesByItem[label] as string),
    );
  if (!validSolution) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato classification.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "classification",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialClassificationQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialClassificationQuestion["solutionPayload"],
  };
}
