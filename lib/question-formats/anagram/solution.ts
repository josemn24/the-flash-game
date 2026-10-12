import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { AnagramQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"anagram"> {
  const tiles = publicPayload.tiles;
  const correctAnswer = solutionPayload.correctAnswer;
  if (
    !Array.isArray(tiles) ||
    tiles.length < 3 ||
    tiles.length > 10 ||
    !tiles.every((tile) => {
      if (!tile || typeof tile !== "object" || Array.isArray(tile)) return false;
      const value = tile as Record<string, unknown>;
      return (
        Object.keys(value).every((key) => ["id", "value"].includes(key)) &&
        typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        value.id.length <= 120 &&
        typeof value.value === "string" &&
        value.value.trim().length > 0 &&
        Array.from(value.value).length === 1
      );
    }) ||
    new Set(tiles.map((tile) => (tile as Record<string, unknown>).id as string)).size !==
      tiles.length ||
    typeof correctAnswer !== "string" ||
    correctAnswer.trim().length === 0 ||
    /\s/.test(correctAnswer) ||
    Array.from(correctAnswer).length !== tiles.length
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const tileSignature = tiles
    .map((tile) => String((tile as Record<string, unknown>).value).toLocaleLowerCase("es"))
    .sort()
    .join("");
  const solutionSignature = Array.from(correctAnswer.toLocaleLowerCase("es")).sort().join("");
  if (tileSignature !== solutionSignature) {
    throw new FormatValidationError("invalid_question_payload");
  }
  return {
    ...base,
    type: "anagram",
    tiles: tiles as AnagramQuestion["tiles"],
    hint: typeof publicPayload.hint === "string" ? publicPayload.hint : undefined,
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
