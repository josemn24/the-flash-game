import { definition } from "./definition";

import type { ServerClassificationQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "classification" }> {
  const { value, base } = publicEnvelope(context, definition);
  const items = value.items;
  const categories = value.categories;
  if (
    !Array.isArray(items) ||
    items.length < 2 ||
    items.length > 20 ||
    !items.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      return (
        Object.keys(record).every((key) => key === "label") &&
        typeof record.label === "string" &&
        record.label.trim().length > 0 &&
        record.label.length <= 500
      );
    }) ||
    new Set(items.map((item) => (item as Record<string, unknown>).label as string)).size !==
      items.length ||
    !Array.isArray(categories) ||
    categories.length < 2 ||
    categories.length > 8 ||
    !categories.every(
      (category) =>
        typeof category === "string" && category.trim().length > 0 && category.length <= 120,
    ) ||
    new Set(categories).size !== categories.length
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "classification",
    items: items.map((item) => ({ label: (item as Record<string, unknown>).label as string })),
    categories,
  } satisfies ServerClassificationQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
