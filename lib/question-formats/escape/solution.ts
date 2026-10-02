import { validatePrivateSolution } from "../private-common";
import { parseStored } from "./stored";

import { isValidEscapeConfiguration, isValidEscapePublicConfiguration } from "@/lib/escape";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { EscapeQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"escape"> {
  const configuration = {
    grid: publicPayload.grid,
    initialBlocks: publicPayload.initialBlocks,
  };
  const referenceSolution = solutionPayload.referenceSolution;
  const question = {
    ...base,
    type: "escape" as const,
    grid: configuration.grid as EscapeQuestion["grid"],
    initialBlocks: configuration.initialBlocks as EscapeQuestion["initialBlocks"],
    referenceSolution: referenceSolution as EscapeQuestion["referenceSolution"],
    optimalMoves: solutionPayload.optimalMoves as number,
    instruction:
      typeof publicPayload.instruction === "string" ? publicPayload.instruction : undefined,
    hideInstruction: publicPayload.hideInstruction === true,
    objectiveLabel:
      typeof publicPayload.objectiveLabel === "string" ? publicPayload.objectiveLabel : undefined,
    hideObjectiveLabel: publicPayload.hideObjectiveLabel === true,
    completionMessage:
      typeof publicPayload.completionMessage === "string"
        ? publicPayload.completionMessage
        : undefined,
    boardLabel: typeof publicPayload.boardLabel === "string" ? publicPayload.boardLabel : undefined,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies EscapeQuestion;
  if (
    !isValidEscapePublicConfiguration(configuration as EscapeQuestion) ||
    !Array.isArray(referenceSolution) ||
    !Number.isSafeInteger(solutionPayload.optimalMoves) ||
    !isValidEscapeConfiguration(question)
  ) {
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
