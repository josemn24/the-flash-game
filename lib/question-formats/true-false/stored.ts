import type {
  FlashEditorialQuestion,
  FlashEditorialTrueFalseQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
  trueFalseSolutionKeys,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "true-false" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato true-false.`,
    ]);
  const publicPayload = publicResult.value;

  if (
    !hasOnlyKeys(solutionPayload, trueFalseSolutionKeys) ||
    typeof solutionPayload.correctAnswer !== "boolean"
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato true-false.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "true-false",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialTrueFalseQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialTrueFalseQuestion["solutionPayload"],
  };
}
