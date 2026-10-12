import { validatePrivateSolution } from "../private-common";

import {
  isQueensBoardSize,
  isValidQueensConfiguration,
  queensCellCount,
  queensGrid,
} from "@/lib/queens";
import { hasOnlyKeys } from "../stored-common";
import type { StoredQuestionContext } from "@/types/contracts/stored-questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import { FormatValidationError, type StoredQuestionBase } from "../types";
export function readStoredSolution(
  context: StoredQuestionContext,
  publicPayload: Record<string, unknown>,
  solutionPayload: Record<string, unknown>,
  base: StoredQuestionBase,
): ResolvedQuestionOfType<"queens"> {
  const grid = publicPayload.grid;
  const regions = publicPayload.regions;
  const prefilledQueens = publicPayload.prefilledQueens;
  const solution = solutionPayload.solution;
  if (
    !hasOnlyKeys(solutionPayload, ["solution", "explanation"]) ||
    (solutionPayload.explanation !== undefined && typeof solutionPayload.explanation !== "string")
  )
    throw new FormatValidationError("invalid_question_solution");
  const gridRecord = grid && typeof grid === "object" && !Array.isArray(grid) ? grid : null;
  const rows = gridRecord && (gridRecord as Record<string, unknown>).rows;
  const columns = gridRecord && (gridRecord as Record<string, unknown>).columns;
  const boardGrid = isQueensBoardSize(rows) && rows === columns ? queensGrid(rows) : null;
  const cellCount = boardGrid ? queensCellCount(boardGrid) : 0;
  if (
    !grid ||
    typeof grid !== "object" ||
    Array.isArray(grid) ||
    !boardGrid ||
    !Array.isArray(regions) ||
    regions.length !== cellCount ||
    !regions.every(
      (region) =>
        typeof region === "number" &&
        Number.isSafeInteger(region) &&
        region >= 0 &&
        region < boardGrid.rows,
    ) ||
    !Array.isArray(prefilledQueens) ||
    !prefilledQueens.every(
      (cell) =>
        typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount,
    ) ||
    !Array.isArray(solution) ||
    solution.length !== boardGrid.rows ||
    !solution.every(
      (cell) =>
        typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount,
    ) ||
    new Set(solution).size !== solution.length
  ) {
    throw new FormatValidationError("invalid_question_payload");
  }
  const question: ResolvedQuestionOfType<"queens"> = {
    ...base,
    type: "queens",
    grid: boardGrid,
    regions,
    prefilledQueens,
    solution,
    explanation: typeof solutionPayload.explanation === "string" ? solutionPayload.explanation : "",
  };
  if (!isValidQueensConfiguration(question))
    throw new FormatValidationError("invalid_question_solution");
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
