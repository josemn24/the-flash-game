import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import {
  isValidWordHashtagConfiguration,
  isValidWordHashtagPublicConfiguration,
} from "@/lib/wordHashtag";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType, WordHashtagQuestion } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"word-hashtag"> {
  const configuration = {
    grid: publicPayload.grid,
    initialLetters: publicPayload.initialLetters,
    maxMoves: publicPayload.maxMoves,
  };
  const words = solutionPayload.words;
  if (
    !isValidWordHashtagPublicConfiguration(configuration as never) ||
    !words ||
    typeof words !== "object" ||
    Array.isArray(words)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const question = {
    ...base,
    type: "word-hashtag" as const,
    grid: { rows: 5, columns: 5 } as const,
    initialLetters: configuration.initialLetters as Array<string | null>,
    maxMoves: configuration.maxMoves as number,
    words: words as WordHashtagQuestion["words"],
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies WordHashtagQuestion;
  if (!isValidWordHashtagConfiguration(question)) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return question;
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
