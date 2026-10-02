import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import {
  isMiniWordleMaxAttempts,
  isMiniWordleWordLength,
  isValidMiniWordleWord,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"mini-wordle"> {
  const wordLength = publicPayload.wordLength;
  const maxAttempts = publicPayload.maxAttempts;
  const correctAnswer = solutionPayload.correctAnswer;
  const additionalGuesses = solutionPayload.additionalGuesses;
  if (
    !isMiniWordleWordLength(wordLength) ||
    !isMiniWordleMaxAttempts(maxAttempts) ||
    typeof correctAnswer !== "string" ||
    !isValidMiniWordleWord(correctAnswer, wordLength) ||
    !Array.isArray(additionalGuesses) ||
    !additionalGuesses.every(
      (guess) => typeof guess === "string" && isValidMiniWordleWord(guess, wordLength),
    )
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "mini-wordle",
    hint: typeof publicPayload.hint === "string" ? publicPayload.hint : undefined,
    wordLength,
    maxAttempts,
    correctAnswer: normalizeMiniWordleWord(correctAnswer),
    additionalGuesses: additionalGuesses.map(normalizeMiniWordleWord),
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
