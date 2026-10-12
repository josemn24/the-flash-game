import { definition } from "./definition";

import type { ServerOddOneOutQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import {
  ServerFlashQuestionError,
  publicEnvelope,
  questionMedia,
  type PublicReadContext,
} from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "odd-one-out" }> {
  const { value, base } = publicEnvelope(context, definition);
  const items = value.items;
  if (!Array.isArray(items) || items.length < 3 || items.length > 8) {
    throw new ServerFlashQuestionError();
  }
  const parsedItems = items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ServerFlashQuestionError();
    }
    const record = item as Record<string, unknown>;
    if (
      !Object.keys(record).every((key) => ["id", "label", "media"].includes(key)) ||
      typeof record.id !== "string" ||
      record.id.trim().length === 0 ||
      record.id.length > 120 ||
      typeof record.label !== "string" ||
      record.label.trim().length === 0 ||
      record.label.length > 500
    ) {
      throw new ServerFlashQuestionError();
    }
    const media = questionMedia(record);
    return {
      id: record.id,
      label: record.label,
      ...(media ? { media } : {}),
    };
  });
  if (new Set(parsedItems.map((item) => item.id)).size !== parsedItems.length) {
    throw new ServerFlashQuestionError();
  }
  return { ...base, type: "odd-one-out", items: parsedItems } satisfies ServerOddOneOutQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
