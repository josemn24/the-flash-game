import { validatePrivateSolution } from "../private-common";
import { isPrivateMultipleChoiceMedia } from "../stored-common";
import { parseStored } from "./stored";

import { isValidEstimationConfiguration, isValidEstimationSolution } from "@/lib/estimation";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { EstimationQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"estimation"> {
  const configuration = {
    min: publicPayload.min,
    max: publicPayload.max,
    step: publicPayload.step,
    initialValue: publicPayload.initialValue,
    unit: publicPayload.unit,
  };
  const media = publicPayload.media;
  const validMedia =
    media === null ||
    (context.payloadSchemaVersion === 1 && media === undefined) ||
    (context.payloadSchemaVersion === 2 && isPrivateMultipleChoiceMedia(media)) ||
    (media &&
      typeof media === "object" &&
      !Array.isArray(media) &&
      (media as Record<string, unknown>).type === "image" &&
      typeof (media as Record<string, unknown>).src === "string" &&
      typeof (media as Record<string, unknown>).alt === "string");
  if (
    (context.payloadSchemaVersion !== 1 && !Object.hasOwn(publicPayload, "media")) ||
    !isValidEstimationConfiguration(configuration) ||
    !validMedia ||
    !isValidEstimationSolution(
      solutionPayload.correctAnswer,
      solutionPayload.tolerance,
      configuration,
    )
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "estimation",
    min: configuration.min as number,
    max: configuration.max as number,
    step: configuration.step as number,
    initialValue: configuration.initialValue as number,
    unit: configuration.unit as string,
    ...(media ? { media: media as EstimationQuestion["media"] } : {}),
    correctAnswer: solutionPayload.correctAnswer as number,
    tolerance: solutionPayload.tolerance as number,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
