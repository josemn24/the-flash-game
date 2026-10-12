import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"progressive-clues"> {
  const clues = publicPayload.clues;
  const cluePenalty = publicPayload.cluePenalty;
  const correctAnswer = solutionPayload.correctAnswer;
  const acceptedAnswers = solutionPayload.acceptedAnswers;
  if (
    !Array.isArray(clues) ||
    clues.length === 0 ||
    clues.length > 20 ||
    !clues.every((clue) => typeof clue === "string" && clue.trim().length > 0) ||
    typeof cluePenalty !== "number" ||
    !Number.isSafeInteger(cluePenalty) ||
    cluePenalty < 0 ||
    typeof correctAnswer !== "string" ||
    !Array.isArray(acceptedAnswers) ||
    !acceptedAnswers.every((answer) => typeof answer === "string" && answer.trim().length > 0)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "progressive-clues",
    clues,
    cluePenalty,
    correctAnswer,
    acceptedAnswers,
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
