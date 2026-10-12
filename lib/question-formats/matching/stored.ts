import type {
  FlashEditorialMatchingQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  isMatchingItem,
  isRecord,
  MATCHING_MAX_PAIRS,
  MATCHING_MIN_PAIRS,
  matchingSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "matching" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato matching.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, matchingSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato matching.`,
    ]);
  }
  const leftItems = publicPayload.leftItems;
  const rightItems = publicPayload.rightItems;
  const matches = solutionPayload.matches;
  const validLeftItems =
    Array.isArray(leftItems) &&
    leftItems.length >= MATCHING_MIN_PAIRS &&
    leftItems.length <= MATCHING_MAX_PAIRS &&
    leftItems.every(isMatchingItem);
  const validRightItems =
    Array.isArray(rightItems) &&
    Array.isArray(leftItems) &&
    rightItems.length === leftItems.length &&
    rightItems.every(isMatchingItem);
  const leftIds = validLeftItems ? leftItems.map((item) => item.id) : [];
  const rightIds = validRightItems ? rightItems.map((item) => item.id) : [];

  const validMatches =
    isRecord(matches) &&
    Object.keys(matches).length === leftIds.length &&
    leftIds.every(
      (leftId) =>
        typeof matches[leftId] === "string" && rightIds.includes(matches[leftId] as string),
    ) &&
    new Set(Object.values(matches)).size === rightIds.length &&
    new Set(leftIds).size === leftIds.length &&
    new Set(rightIds).size === rightIds.length;
  if (!validMatches) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato matching.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "matching",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialMatchingQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialMatchingQuestion["solutionPayload"],
  };
}
