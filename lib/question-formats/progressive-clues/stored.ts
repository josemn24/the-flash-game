import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  FlashEditorialProgressiveCluesQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  nonEmptyString,
  progressiveCluesSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "progressive-clues" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-clues.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, progressiveCluesSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-clues.`,
    ]);
  }

  const correctAnswer = solutionPayload.correctAnswer;
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  const normalizedAcceptedAnswers = Array.isArray(acceptedAnswers)
    ? acceptedAnswers.map((answer) => (typeof answer === "string" ? normalizeAnswer(answer) : ""))
    : [];
  if (
    typeof correctAnswer !== "string" ||
    !nonEmptyString(correctAnswer, 500) ||
    !Array.isArray(acceptedAnswers) ||
    acceptedAnswers.length < 1 ||
    acceptedAnswers.length > 100 ||
    !acceptedAnswers.every((answer) => nonEmptyString(answer, 500)) ||
    new Set(normalizedAcceptedAnswers).size !== normalizedAcceptedAnswers.length ||
    !normalizedAcceptedAnswers.includes(normalizeAnswer(correctAnswer))
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-clues.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "progressive-clues",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialProgressiveCluesQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialProgressiveCluesQuestion["solutionPayload"],
  };
}
