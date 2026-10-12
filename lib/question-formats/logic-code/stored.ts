import type {
  FlashEditorialLogicCodeQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  logicCodeSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "logic-code" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato logic-code.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, logicCodeSolutionKeys)) {
    throw new FlashEditorialValidationError([`questions[${index}] no cumple el contrato Flash.`]);
  }

  const codeLength = publicPayload.codeLength;
  const correctAnswer = solutionPayload.correctAnswer;

  if (
    typeof correctAnswer !== "string" ||
    correctAnswer.length !== codeLength ||
    !/^[0-9]+$/.test(correctAnswer)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato logic-code.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "logic-code",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialLogicCodeQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialLogicCodeQuestion["solutionPayload"],
  };
}
