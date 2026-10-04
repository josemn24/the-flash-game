import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  FlashEditorialProgressiveImageQuestion,
  FlashEditorialQuestion,
} from "@/types/contracts/stored-questions";
import type { StoredPublicContext } from "../stored-common";
import {
  FlashEditorialValidationError,
  hasOnlyKeys,
  nonEmptyString,
  progressiveImageSolutionKeys,
  storedEnvelope,
} from "../stored-common";
import { validateStoredPublic } from "./validation";
export function parseStored(
  input: unknown,
  index = 0,
  publicRepresentation?: StoredPublicContext["publicRepresentation"],
  profile: StoredPublicContext["profile"] = "publication",
): Extract<FlashEditorialQuestion, { type: "progressive-image" }> {
  const { value, publicPayload: rawPublicPayload, solutionPayload } = storedEnvelope(input, index);
  const publicResult = validateStoredPublic(rawPublicPayload, {
    profile,
    publicRepresentation,
    payloadSchemaVersion: Number(value.payloadSchemaVersion),
    timeLimitMs: Number(value.timeLimitMs),
  });
  if (!publicResult.ok)
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-image.`,
    ]);
  const publicPayload = publicResult.value;

  if (!hasOnlyKeys(solutionPayload, progressiveImageSolutionKeys)) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-image.`,
    ]);
  }
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  const normalizedAcceptedAnswers = Array.isArray(acceptedAnswers)
    ? acceptedAnswers.map((answer) => (typeof answer === "string" ? normalizeAnswer(answer) : ""))
    : [];
  const correctAnswer = solutionPayload.correctAnswer;

  if (
    typeof correctAnswer !== "string" ||
    !nonEmptyString(correctAnswer, 500) ||
    !Array.isArray(acceptedAnswers) ||
    acceptedAnswers.length < 1 ||
    acceptedAnswers.length > 100 ||
    !acceptedAnswers.every((answer) => nonEmptyString(answer, 500)) ||
    new Set(normalizedAcceptedAnswers).size !== normalizedAcceptedAnswers.length ||
    !normalizedAcceptedAnswers.includes(normalizeAnswer(correctAnswer)) ||
    (profile === "publication" &&
      normalizeAnswer((publicPayload.surface as Record<string, unknown>).alt as string).includes(
        normalizeAnswer(correctAnswer),
      )) ||
    !nonEmptyString(solutionPayload.solutionAlt, 500)
  ) {
    throw new FlashEditorialValidationError([
      `questions[${index}] no cumple el contrato progressive-image.`,
    ]);
  }
  return {
    slug: value.slug as string,
    type: "progressive-image",
    payloadSchemaVersion: value.payloadSchemaVersion as 1 | 2,
    timeLimitMs: value.timeLimitMs as number,
    points: value.points as number,
    publicPayload: publicPayload as FlashEditorialProgressiveImageQuestion["publicPayload"],
    solutionPayload: solutionPayload as FlashEditorialProgressiveImageQuestion["solutionPayload"],
  };
}
