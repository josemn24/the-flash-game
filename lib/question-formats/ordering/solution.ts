import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { OrderingQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"ordering"> {
  const items = publicPayload.items;
  const correctOrder = solutionPayload.correctOrder;
  const directionLabels = publicPayload.directionLabels;
  if (
    !Array.isArray(items) ||
    items.length < 2 ||
    items.length > 8 ||
    !items.every(
      (item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500,
    ) ||
    new Set(items).size !== items.length ||
    !Array.isArray(correctOrder) ||
    correctOrder.length !== items.length ||
    !correctOrder.every((item) => typeof item === "string" && items.includes(item)) ||
    new Set(correctOrder).size !== correctOrder.length ||
    (directionLabels !== undefined &&
      directionLabels !== null &&
      (typeof directionLabels !== "object" ||
        Array.isArray(directionLabels) ||
        !Object.keys(directionLabels).every((key) => ["start", "end"].includes(key)) ||
        !Object.hasOwn(directionLabels, "start") ||
        !Object.hasOwn(directionLabels, "end") ||
        typeof (directionLabels as Record<string, unknown>).start !== "string" ||
        typeof (directionLabels as Record<string, unknown>).end !== "string" ||
        ((directionLabels as Record<string, unknown>).start as string).trim().length === 0 ||
        ((directionLabels as Record<string, unknown>).end as string).trim().length === 0))
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "ordering",
    items,
    correctOrder,
    directionLabels:
      directionLabels && typeof directionLabels === "object"
        ? (directionLabels as OrderingQuestion["directionLabels"])
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
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
