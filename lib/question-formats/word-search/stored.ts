import { isValidWordSearchConfiguration } from "@/lib/wordSearch";
import type {
  FlashEditorialQuestion,
  FlashEditorialWordSearchQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  isRecord,
  nonEmptyString,
  storedEnvelope,
  wordSearchSolutionKeys,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "word-search" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato word-search.`,
    ]);
  const publicPayload = publicResult.value;

  const grid = publicPayload.grid;
  const letters = publicPayload.letters;
  const targets = publicPayload.targets;
  const positions = solutionPayload.positionsByTargetId;
  const validTargets =
    Array.isArray(targets) &&
    targets.length >= 2 &&
    targets.length <= 8 &&
    targets.every(
      (target) =>
        isRecord(target) &&
        hasOnlyKeys(target, ["id", "word"]) &&
        nonEmptyString(target.id, 120) &&
        nonEmptyString(target.word, 120),
    );
  const targetIds = validTargets
    ? (targets as Array<Record<string, unknown>>).map((t) => t.id as string)
    : [];
  const validPositions =
    isRecord(positions) &&
    validTargets &&
    Object.keys(positions).length === targetIds.length &&
    targetIds.every((id) => {
      const position = positions[id];
      return (
        isRecord(position) &&
        hasOnlyKeys(position, ["startCell", "endCell"]) &&
        Number.isSafeInteger(position.startCell) &&
        Number.isSafeInteger(position.endCell)
      );
    });
  const candidate = {
    type: "word-search",
    grid,
    letters,
    targets:
      validTargets && validPositions
        ? (targets as Array<Record<string, unknown>>).map((target) => ({
            id: target.id as string,
            word: target.word as string,
            startCell: (positions as Record<string, Record<string, unknown>>)[target.id as string]
              .startCell as number,
            endCell: (positions as Record<string, Record<string, unknown>>)[target.id as string]
              .endCell as number,
          }))
        : [],
  };
  if (
    !hasOnlyKeys(solutionPayload, wordSearchSolutionKeys) ||
    !validPositions ||
    !isValidWordSearchConfiguration(candidate as never)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato word-search.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "word-search",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialWordSearchQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialWordSearchQuestion["solutionPayload"],
  };
}
