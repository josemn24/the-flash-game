import { validatePrivateSolution } from "../private-common";

import { isValidConnectPairsConfiguration } from "@/lib/connectPairs";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ConnectPairsQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"connect-pairs"> {
  const grid = publicPayload.grid;
  const pairs = publicPayload.pairs;
  const paths = solutionPayload.paths;
  if (publicPayload.requireFullCoverage !== true) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const question = {
    ...base,
    type: "connect-pairs" as const,
    grid: grid as ConnectPairsQuestion["grid"],
    pairs: pairs as ConnectPairsQuestion["pairs"],
    solutionPaths: paths as ConnectPairsQuestion["solutionPaths"],
    requireFullCoverage: true as const,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  } satisfies ConnectPairsQuestion;
  if (!isValidConnectPairsConfiguration(question)) {
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
  return validatePrivateSolution(context, publicPayload, solution, readStoredSolution);
}
