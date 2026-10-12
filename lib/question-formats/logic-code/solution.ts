import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { LogicCodeQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"logic-code"> {
  const clues = publicPayload.clues;
  const codeLength = publicPayload.codeLength;
  const correctAnswer = solutionPayload.correctAnswer;
  if (
    typeof codeLength !== "number" ||
    !Number.isSafeInteger(codeLength) ||
    codeLength < 1 ||
    codeLength > 12 ||
    !Array.isArray(clues) ||
    clues.length === 0 ||
    clues.length > 20 ||
    !clues.every((clue) => {
      if (!clue || typeof clue !== "object" || Array.isArray(clue)) return false;
      const value = clue as Record<string, unknown>;
      return (
        typeof value.code === "string" &&
        typeof value.hint === "string" &&
        value.code.length === codeLength &&
        /^[0-9]+$/.test(value.code)
      );
    }) ||
    typeof correctAnswer !== "string" ||
    correctAnswer.length !== codeLength ||
    !/^[0-9]+$/.test(correctAnswer)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "logic-code",
    clues: clues as LogicCodeQuestion["clues"],
    codeLength,
    correctAnswer,
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
