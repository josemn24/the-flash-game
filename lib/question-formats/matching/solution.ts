import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { MatchingQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"matching"> {
  const leftItems = publicPayload.leftItems;
  const rightItems = publicPayload.rightItems;
  const matches = solutionPayload.matches;
  if (
    !Array.isArray(leftItems) ||
    !Array.isArray(rightItems) ||
    leftItems.length < 3 ||
    leftItems.length > 6 ||
    rightItems.length !== leftItems.length ||
    !leftItems.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const value = item as Record<string, unknown>;
      return (
        !Object.hasOwn(value, "correctMatchId") &&
        typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        value.id.length <= 120 &&
        typeof value.label === "string" &&
        value.label.trim().length > 0 &&
        value.label.length <= 500
      );
    }) ||
    !rightItems.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const value = item as Record<string, unknown>;
      return (
        !Object.hasOwn(value, "correctMatchId") &&
        typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        value.id.length <= 120 &&
        typeof value.label === "string" &&
        value.label.trim().length > 0 &&
        value.label.length <= 500
      );
    }) ||
    !matches ||
    typeof matches !== "object" ||
    Array.isArray(matches)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const leftIds = leftItems.map((item) => (item as Record<string, unknown>).id as string);
  const rightIds = rightItems.map((item) => (item as Record<string, unknown>).id as string);
  const matchRecord = matches as Record<string, unknown>;
  if (
    new Set(leftIds).size !== leftIds.length ||
    new Set(rightIds).size !== rightIds.length ||
    Object.keys(matchRecord).length !== leftIds.length ||
    !leftIds.every(
      (leftId) =>
        typeof matchRecord[leftId] === "string" && rightIds.includes(matchRecord[leftId] as string),
    ) ||
    new Set(Object.values(matchRecord)).size !== rightIds.length
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "matching",
    leftItems: leftItems.map((item) => ({
      ...(item as MatchingQuestion["leftItems"][number]),
      correctMatchId: matchRecord[(item as Record<string, unknown>).id as string] as string,
    })),
    rightItems: rightItems as MatchingQuestion["rightItems"],
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
