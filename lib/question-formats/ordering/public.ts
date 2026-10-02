import { definition } from "./definition";

import type { ServerOrderingQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "ordering" }> {
  const { value, base } = publicEnvelope(context, definition);
  const items = value.items;
  const directionLabels = value.directionLabels;
  if (
    !Array.isArray(items) ||
    items.length < 2 ||
    items.length > 8 ||
    !items.every(
      (item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500,
    ) ||
    new Set(items).size !== items.length
  ) {
    throw new ServerFlashQuestionError();
  }
  let parsedDirectionLabels: ServerOrderingQuestion["directionLabels"] = null;
  if (directionLabels !== undefined && directionLabels !== null) {
    if (
      typeof directionLabels !== "object" ||
      Array.isArray(directionLabels) ||
      !Object.keys(directionLabels).every((key) => ["start", "end"].includes(key))
    ) {
      throw new ServerFlashQuestionError();
    }
    const labels = directionLabels as Record<string, unknown>;
    if (
      typeof labels.start !== "string" ||
      labels.start.trim().length === 0 ||
      labels.start.length > 120 ||
      typeof labels.end !== "string" ||
      labels.end.trim().length === 0 ||
      labels.end.length > 120
    ) {
      throw new ServerFlashQuestionError();
    }
    parsedDirectionLabels = { start: labels.start, end: labels.end };
  }
  return {
    ...base,
    type: "ordering",
    items,
    directionLabels: parsedDirectionLabels,
  } satisfies ServerOrderingQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
