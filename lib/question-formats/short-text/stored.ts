import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type { FlashEditorialQuestion } from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  nonEmptyString,
  shortTextSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
): Extract<FlashEditorialQuestion, { type: "short-text" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato short-text.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, shortTextSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato short-text.`,
    ]);
  }
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  const normalizedAcceptedAnswers = Array.isArray(acceptedAnswers)
    ? acceptedAnswers.map((answer) => (typeof answer === "string" ? normalizeAnswer(answer) : ""))
    : [];
  if (
    !nonEmptyString(solutionPayload.correctAnswer, 500) ||
    !Array.isArray(acceptedAnswers) ||
    acceptedAnswers.length < 1 ||
    acceptedAnswers.length > 100 ||
    !acceptedAnswers.every((answer) => nonEmptyString(answer, 500)) ||
    new Set(normalizedAcceptedAnswers).size !== normalizedAcceptedAnswers.length ||
    !normalizedAcceptedAnswers.includes(normalizeAnswer(solutionPayload.correctAnswer))
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato short-text.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "short-text",
    payloadSchemaVersion: 1,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as Extract<
      FlashEditorialQuestion,
      { type: "short-text" }
    >["publicPayload"],
    solutionPayload: solutionPayload as Extract<
      FlashEditorialQuestion,
      { type: "short-text" }
    >["solutionPayload"],
  };
}
