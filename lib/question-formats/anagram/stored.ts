import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  FlashEditorialAnagramQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  ANAGRAM_MAX_TILES,
  ANAGRAM_MIN_TILES,
  anagramSolutionKeys,
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
): Extract<FlashEditorialQuestion, { type: "anagram" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato anagram.`]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, anagramSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato anagram.`]);
  }
  const tiles = publicPayload.tiles;
  const correctAnswer = solutionPayload.correctAnswer;
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

  const tileSignature = validTiles
    ? tiles
        .map((tile) => normalizeAnswer((tile as Record<string, unknown>).value as string))
        .sort()
        .join("")
    : "";
  const solutionSignature =
    typeof correctAnswer === "string"
      ? Array.from(normalizeAnswer(correctAnswer)).sort().join("")
      : "";
  if (
    typeof correctAnswer !== "string" ||
    !nonEmptyString(correctAnswer, 120) ||
    /\s/.test(correctAnswer) ||
    Array.from(correctAnswer).length !== tiles.length ||
    tileSignature !== solutionSignature
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato anagram.`]);
  }
  return {
    slug: value.slug as string,
    type: "anagram",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialAnagramQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialAnagramQuestion["solutionPayload"],
  };
}
