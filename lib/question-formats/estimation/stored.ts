import { isValidEstimationSolution } from "@/lib/estimation";
import type {
  FlashEditorialEstimationQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  estimationSolutionKeys,
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "estimation" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato estimation.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, estimationSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato estimation.`,
    ]);
  }
  const configuration = {
    min: publicPayload.min,
    max: publicPayload.max,
    step: publicPayload.step,
    initialValue: publicPayload.initialValue,
    unit: publicPayload.unit,
  };
  const correctAnswer = solutionPayload.correctAnswer;
  const tolerance = solutionPayload.tolerance;
  if (!isValidEstimationSolution(correctAnswer, tolerance, configuration)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato estimation.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "estimation",
    payloadSchemaVersion: 2,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialEstimationQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialEstimationQuestion["solutionPayload"],
  };
}
