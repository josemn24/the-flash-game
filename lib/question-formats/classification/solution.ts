import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ClassificationQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"classification"> {
  const items = publicPayload.items;
  const categories = publicPayload.categories;
  const categoriesByItem = solutionPayload.categoriesByItem;
  if (
    !Array.isArray(items) ||
    items.length < 2 ||
    items.length > 20 ||
    !items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        Object.keys(item).every((key) => key === "label") &&
        typeof (item as Record<string, unknown>).label === "string" &&
        ((item as Record<string, unknown>).label as string).trim().length > 0,
    ) ||
    new Set(items.map((item) => (item as Record<string, unknown>).label as string)).size !==
      items.length ||
    !Array.isArray(categories) ||
    categories.length < 2 ||
    categories.length > 8 ||
    !categories.every((category) => typeof category === "string" && category.trim().length > 0) ||
    new Set(categories).size !== categories.length ||
    !categoriesByItem ||
    typeof categoriesByItem !== "object" ||
    Array.isArray(categoriesByItem)
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const solution = categoriesByItem as Record<string, unknown>;
  const labels = items.map((item) => (item as Record<string, unknown>).label as string);
  if (
    Object.keys(solution).length !== labels.length ||
    labels.some(
      (label) =>
        typeof solution[label] !== "string" || !categories.includes(solution[label] as string),
    ) ||
    Object.keys(solution).some((label) => !labels.includes(label))
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "classification",
    items: items.map((item) => ({
      label: (item as Record<string, unknown>).label as string,
      correctCategory: solution[(item as Record<string, unknown>).label as string] as string,
    })),
    categories,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } as ClassificationQuestion;
}

/** Validates the private payload against the validated stored public payload. */
export function validateSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solution: unknown,
) {
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution, parseStored);
}
