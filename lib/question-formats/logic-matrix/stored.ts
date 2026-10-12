import type {
  FlashEditorialLogicMatrixQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  logicMatrixSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "logic-matrix" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato logic-matrix.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, logicMatrixSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }
  const correctOptionId = solutionPayload.correctOptionId;

  const optionIds = publicPayload.optionIds;
  if (typeof correctOptionId !== "string" || !optionIds.includes(correctOptionId)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato logic-matrix.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "logic-matrix",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as unknown as FlashEditorialLogicMatrixQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialLogicMatrixQuestion["solutionPayload"],
  };
}
