import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { MultipleChoiceQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"multiple-choice"> {
  const options = publicPayload.options;
  const correctAnswer = solutionPayload.correctAnswer;
  if (
    !Array.isArray(options) ||
    !options.every((option) => typeof option === "string") ||
    typeof correctAnswer !== "string" ||
    !options.includes(correctAnswer)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "multiple-choice",
    options,
    correctAnswer,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
    ...(publicPayload.media
      ? { media: publicPayload.media as MultipleChoiceQuestion["media"] }
      : {}),
    ...(publicPayload.promptVisual
      ? { promptVisual: publicPayload.promptVisual as MultipleChoiceQuestion["promptVisual"] }
      : {}),
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
