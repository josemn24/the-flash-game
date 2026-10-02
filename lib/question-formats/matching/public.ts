import { definition } from "./definition";

import type { ServerMatchingQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "matching" }> {
  const { value, base } = publicEnvelope(context, definition);
  const leftItems = value.leftItems;
  const rightItems = value.rightItems;
  const isItem = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return (
      Object.keys(record).every((key) => ["id", "label", "icon", "media"].includes(key)) &&
      typeof record.id === "string" &&
      record.id.trim().length > 0 &&
      record.id.length <= 120 &&
      typeof record.label === "string" &&
      record.label.trim().length > 0 &&
      record.label.length <= 500 &&
      (record.icon === undefined || (typeof record.icon === "string" && record.icon.length <= 32))
    );
  };
  const validLeftItems =
    Array.isArray(leftItems) &&
    leftItems.length >= 3 &&
    leftItems.length <= 6 &&
    leftItems.every(isItem);
  const validRightItems =
    Array.isArray(rightItems) &&
    rightItems.length === (Array.isArray(leftItems) ? leftItems.length : 0) &&
    rightItems.every(isItem);
  const leftIds = validLeftItems
    ? leftItems.map((item) => (item as Record<string, unknown>).id as string)
    : [];
  const rightIds = validRightItems
    ? rightItems.map((item) => (item as Record<string, unknown>).id as string)
    : [];
  if (
    !validLeftItems ||
    !validRightItems ||
    new Set(leftIds).size !== leftIds.length ||
    new Set(rightIds).size !== rightIds.length
  ) {
    throw new ServerFlashQuestionError();
  }
  const safeLeftItems = leftItems as ServerMatchingQuestion["leftItems"];
  const safeRightItems = rightItems as ServerMatchingQuestion["rightItems"];
  return {
    ...base,
    type: "matching",
    leftItems: safeLeftItems,
    rightItems: safeRightItems,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
