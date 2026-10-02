import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import { isValidWordSearchConfiguration } from "@/lib/wordSearch";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType, WordSearchQuestion } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"word-search"> {
  const grid = publicPayload.grid;
  const letters = publicPayload.letters;
  const publicTargets = publicPayload.targets;
  const positions = solutionPayload.positionsByTargetId;
  if (
    !grid ||
    typeof grid !== "object" ||
    Array.isArray(grid) ||
    !Number.isSafeInteger((grid as Record<string, unknown>).rows) ||
    !Number.isSafeInteger((grid as Record<string, unknown>).columns) ||
    !Array.isArray(letters) ||
    !Array.isArray(publicTargets) ||
    !positions ||
    typeof positions !== "object" ||
    Array.isArray(positions) ||
    !publicTargets.every((target) => {
      if (!target || typeof target !== "object" || Array.isArray(target)) return false;
      const value = target as Record<string, unknown>;
      const position = (positions as Record<string, unknown>)[String(value.id)];
      return (
        typeof value.id === "string" &&
        typeof value.word === "string" &&
        position &&
        typeof position === "object" &&
        !Array.isArray(position) &&
        Number.isSafeInteger((position as Record<string, unknown>).startCell) &&
        Number.isSafeInteger((position as Record<string, unknown>).endCell)
      );
    })
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const question = {
    ...base,
    type: "word-search" as const,
    grid: grid as WordSearchQuestion["grid"],
    letters: letters as string[],
    targets: publicTargets.map((target) => {
      const value = target as Record<string, unknown>;
      const position = (positions as Record<string, Record<string, unknown>>)[value.id as string];
      return {
        id: value.id as string,
        word: value.word as string,
        startCell: position.startCell as number,
        endCell: position.endCell as number,
      };
    }),
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies WordSearchQuestion;
  if (!isValidWordSearchConfiguration(question)) {
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
