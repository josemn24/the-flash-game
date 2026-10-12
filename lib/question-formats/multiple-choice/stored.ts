import type {
  FlashEditorialMultipleChoiceQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  multipleChoiceSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "multiple-choice" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, multipleChoiceSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }
  const options = publicPayload.options;
  const correctAnswer = solutionPayload.correctAnswer;
  if (typeof correctAnswer !== "string" || !options.includes(correctAnswer)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }
  return {
    slug: value.slug as string,
    type: "multiple-choice",
    payloadSchemaVersion: value.payloadSchemaVersion as 1 | 2,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialMultipleChoiceQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialMultipleChoiceQuestion["solutionPayload"],
  };
}
