import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import { isValidZipConfiguration, isValidZipPublicConfiguration } from "@/lib/zip";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType, ZipQuestion } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"zip"> {
  const configuration = {
    grid: publicPayload.grid,
    checkpoints: publicPayload.checkpoints,
  };
  const solution = solutionPayload.solution;
  if (
    !isValidZipPublicConfiguration(configuration) ||
    !Array.isArray(solution) ||
    solution.length !== 25 ||
    !solution.every((cell) => Number.isSafeInteger(cell))
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const question = {
    ...base,
    type: "zip" as const,
    grid: configuration.grid,
    checkpoints: configuration.checkpoints,
    solution,
    instruction:
      typeof publicPayload.instruction === "string" ? publicPayload.instruction : undefined,
    mapNote: typeof publicPayload.mapNote === "string" ? publicPayload.mapNote : undefined,
    boardLabel: typeof publicPayload.boardLabel === "string" ? publicPayload.boardLabel : undefined,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies ZipQuestion;
  if (!isValidZipConfiguration(question)) {
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
