import { isValidEscapeConfiguration } from "@/lib/escape";
import type {
  FlashEditorialEscapeQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { EscapeQuestion } from "@/types/gameplay";
import type { StoredPublicContext } from "../stored-common";
import {
  escapeSolutionKeys,
  FlashEditorialValidationError,
  hasOnlyKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "escape" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato escape.`]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, escapeSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato escape.`]);
  }
  const configuration = {
    grid: publicPayload.grid,
    initialBlocks: publicPayload.initialBlocks,
  };
  const referenceSolution = solutionPayload.referenceSolution;
  const legacyQuestion: EscapeQuestion = {
    id: value.slug as string,
    type: "escape",
    category: typeof publicPayload.category === "string" ? publicPayload.category : "",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [], lifeSkills: [] },
    question: publicPayload.question as string,
    grid: configuration.grid as EscapeQuestion["grid"],
    initialBlocks: configuration.initialBlocks as EscapeQuestion["initialBlocks"],
    referenceSolution: referenceSolution as EscapeQuestion["referenceSolution"],
    optimalMoves: solutionPayload.optimalMoves as number,
    timeLimit: (value.timeLimitMs as number) / 1000,
    points: value.points as number,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    ...(typeof publicPayload.instruction === "string"
      ? { instruction: publicPayload.instruction }
      : {}),
    ...(typeof publicPayload.hideInstruction === "boolean"
      ? { hideInstruction: publicPayload.hideInstruction }
      : {}),
    ...(typeof publicPayload.objectiveLabel === "string"
      ? { objectiveLabel: publicPayload.objectiveLabel }
      : {}),
    ...(typeof publicPayload.hideObjectiveLabel === "boolean"
      ? { hideObjectiveLabel: publicPayload.hideObjectiveLabel }
      : {}),
    ...(typeof publicPayload.completionMessage === "string"
      ? { completionMessage: publicPayload.completionMessage }
      : {}),
    ...(typeof publicPayload.boardLabel === "string"
      ? { boardLabel: publicPayload.boardLabel }
      : {}),
  };

  if (
    !Array.isArray(referenceSolution) ||
    !Number.isSafeInteger(solutionPayload.optimalMoves) ||
    !isValidEscapeConfiguration(legacyQuestion)
  ) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato escape.`]);
  }
  return {
    slug: value.slug as string,
    type: "escape",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialEscapeQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialEscapeQuestion["solutionPayload"],
  };
}
