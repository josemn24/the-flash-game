import type {
  FlashEditorialOddOneOutQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  isMedia,
  isRecord,
  nonEmptyString,
  ODD_ONE_OUT_MAX_ITEMS,
  ODD_ONE_OUT_MIN_ITEMS,
  oddOneOutSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "odd-one-out" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato odd-one-out.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, oddOneOutSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato odd-one-out.`,
    ]);
  }
  const items = publicPayload.items;
  const correctAnswer = solutionPayload.correctAnswer;
  const validItems =
    Array.isArray(items) &&
    items.length >= ODD_ONE_OUT_MIN_ITEMS &&
    items.length <= ODD_ONE_OUT_MAX_ITEMS &&
    items.every((item) => {
      if (!isRecord(item) || !hasOnlyKeys(item, ["id", "label", "media"])) return false;
      return nonEmptyString(item.id, 120) && nonEmptyString(item.label, 500) && isMedia(item.media);
    });
  const ids = validItems ? items.map((item) => (item as Record<string, unknown>).id as string) : [];
  if (typeof correctAnswer !== "string" || !ids.includes(correctAnswer)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato odd-one-out.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "odd-one-out",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialOddOneOutQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialOddOneOutQuestion["solutionPayload"],
  };
}
