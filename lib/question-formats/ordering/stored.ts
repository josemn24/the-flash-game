import type {
  FlashEditorialOrderingQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  nonEmptyString,
  ORDERING_MAX_ITEMS,
  ORDERING_MIN_ITEMS,
  orderingSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "ordering" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato ordering.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, orderingSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato ordering.`,
    ]);
  }
  const items = publicPayload.items;
  const correctOrder = solutionPayload.correctOrder;
  const validItems =
    Array.isArray(items) &&
    items.length >= ORDERING_MIN_ITEMS &&
    items.length <= ORDERING_MAX_ITEMS &&
    items.every((item) => nonEmptyString(item, 500));

  const validCorrectOrder =
    Array.isArray(correctOrder) &&
    validItems &&
    correctOrder.length === items.length &&
    correctOrder.every((item) => typeof item === "string" && items.includes(item));
  if (!validCorrectOrder || new Set(correctOrder).size !== correctOrder.length) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato ordering.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "ordering",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialOrderingQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialOrderingQuestion["solutionPayload"],
  };
}
