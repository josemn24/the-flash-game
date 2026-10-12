import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import {
  ANAGRAM_MAX_TILES,
  ANAGRAM_MIN_TILES,
  anagramPublicPayloadKeys,
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
    const tiles = publicPayload.tiles;
    const validTiles =
      Array.isArray(tiles) &&
      tiles.length >= ANAGRAM_MIN_TILES &&
      tiles.length <= ANAGRAM_MAX_TILES &&
      tiles.every(
        (tile) =>
          isRecord(tile) &&
          hasExactKeys(tile, ["id", "value"]) &&
          nonEmptyString(tile.id, 120) &&
          typeof tile.value === "string" &&
          tile.value.trim().length > 0 &&
          Array.from(tile.value).length === 1,
      );
    const tileIds = validTiles
      ? tiles.map((tile) => (tile as Record<string, unknown>).id as string)
      : [];
    if (!hasOnlyKeys(publicPayload, anagramPublicPayloadKeys))
      throw new FormatValidationError("invalid_question_payload");
    if (!validTiles) throw new FormatValidationError("invalid_question_payload");
    if (new Set(tileIds).size !== tileIds.length)
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["anagram"]["publicPayload"];
  });
}
