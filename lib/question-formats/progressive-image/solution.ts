import { validatePrivateSolution } from "../private-common";
import { isPrivateImageSurface } from "../stored-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ProgressiveImageQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"progressive-image"> {
  const surface = publicPayload.surface;
  const revealDurationMs = publicPayload.revealDurationMs;
  const correctAnswer = solutionPayload.correctAnswer;
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  if (
    !surface ||
    typeof surface !== "object" ||
    Array.isArray(surface) ||
    (typeof (surface as Record<string, unknown>).src !== "string" &&
      !(context.payloadSchemaVersion === 2 && isPrivateImageSurface(surface))) ||
    typeof (surface as Record<string, unknown>).alt !== "string" ||
    !Number.isSafeInteger((surface as Record<string, unknown>).width) ||
    Number((surface as Record<string, unknown>).width) <= 0 ||
    !Number.isSafeInteger((surface as Record<string, unknown>).height) ||
    Number((surface as Record<string, unknown>).height) <= 0 ||
    ((surface as Record<string, unknown>).fit !== undefined &&
      (surface as Record<string, unknown>).fit !== "cover" &&
      (surface as Record<string, unknown>).fit !== "contain") ||
    typeof revealDurationMs !== "number" ||
    !Number.isSafeInteger(revealDurationMs) ||
    revealDurationMs <= 0 ||
    revealDurationMs >= context.timeLimitMs ||
    typeof correctAnswer !== "string" ||
    !Array.isArray(acceptedAnswers) ||
    !acceptedAnswers.every((answer) => typeof answer === "string") ||
    typeof solutionPayload.solutionAlt !== "string"
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "progressive-image",
    surface: surface as ProgressiveImageQuestion["surface"],
    revealDuration: revealDurationMs / 1000,
    correctAnswer,
    acceptedAnswers,
    solutionAlt: solutionPayload.solutionAlt,
    answerLabel:
      typeof publicPayload.answerLabel === "string" ? publicPayload.answerLabel : undefined,
    answerPlaceholder:
      typeof publicPayload.answerPlaceholder === "string"
        ? publicPayload.answerPlaceholder
        : undefined,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(
    context,
    publicPayload,
    solution,
    readStoredSolution,
    // Frozen versions may contain old editorial captions. Their metadata must
    // not prevent an already received answer (or a timeout) from being scored.
    (input, index, publicRepresentation) =>
      parseStored(input, index, publicRepresentation, "published"),
  );
}
