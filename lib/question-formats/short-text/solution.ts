import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType, ShortTextQuestion } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"short-text"> {
  const correctAnswer = solutionPayload.correctAnswer;
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  if (
    typeof correctAnswer !== "string" ||
    !Array.isArray(acceptedAnswers) ||
    !acceptedAnswers.every((answer) => typeof answer === "string")
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "short-text",
    correctAnswer,
    acceptedAnswers,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies ShortTextQuestion;
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
