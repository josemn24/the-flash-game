import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { OddOneOutQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"odd-one-out"> {
  const items = publicPayload.items;
  const correctAnswer = solutionPayload.correctAnswer;
  if (
    !Array.isArray(items) ||
    items.length < 3 ||
    items.length > 8 ||
    !items.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const value = item as Record<string, unknown>;
      return (
        !Object.hasOwn(value, "correctAnswer") &&
        !Object.hasOwn(value, "correctMatchId") &&
        typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        value.id.length <= 120 &&
        typeof value.label === "string" &&
        value.label.trim().length > 0 &&
        value.label.length <= 500
      );
    }) ||
    typeof correctAnswer !== "string"
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const itemIds = items.map((item) => (item as Record<string, unknown>).id as string);
  if (new Set(itemIds).size !== itemIds.length || !itemIds.includes(correctAnswer)) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "odd-one-out",
    items: items as OddOneOutQuestion["items"],
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
