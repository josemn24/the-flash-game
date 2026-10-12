import { definition } from "./definition";

import type { ServerAnagramQuestion } from "@/types/gameplay/challenge";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "anagram" }> {
  const { value, base } = publicEnvelope(context, definition);
  const tiles = value.tiles;
  const hint = value.hint;
  if (
    !Array.isArray(tiles) ||
    tiles.length < 3 ||
    tiles.length > 10 ||
    !tiles.every((tile) => {
      if (!tile || typeof tile !== "object" || Array.isArray(tile)) return false;
      const record = tile as Record<string, unknown>;
      return (
        Object.keys(record).every((key) => ["id", "value"].includes(key)) &&
        typeof record.id === "string" &&
        record.id.trim().length > 0 &&
        record.id.length <= 120 &&
        typeof record.value === "string" &&
        record.value.trim().length > 0 &&
        Array.from(record.value).length === 1
      );
    }) ||
    new Set(tiles.map((tile) => (tile as Record<string, unknown>).id as string)).size !==
      tiles.length ||
    (hint !== undefined && hint !== null && (typeof hint !== "string" || hint.length > 500))
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "anagram",
    tiles: tiles.map((tile) => ({
      id: (tile as Record<string, unknown>).id as string,
      value: (tile as Record<string, unknown>).value as string,
    })),
    hint: typeof hint === "string" ? hint : null,
  } satisfies ServerAnagramQuestion;
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
