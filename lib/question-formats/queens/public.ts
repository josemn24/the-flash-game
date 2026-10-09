import { definition } from "./definition";

import type { ServerQueensProgress } from "@/types/gameplay/challenge";

import {
  isQueensBoardSize,
  queensCellCount,
  queensGrid,
  QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS,
} from "@/lib/queens";

import type { ServerFlashQuestion } from "@/types/gameplay/challenge";
import { publicEnvelope, type PublicReadContext, ServerFlashQuestionError } from "../public-common";
import { validationResult } from "../types";
export function readPublic(
  context: PublicReadContext,
): Extract<ServerFlashQuestion, { type: "queens" }> {
  const { value, base } = publicEnvelope(context, definition);
  const { progress } = context;
  const grid = value.grid;
  const regions = value.regions;
  const prefilledQueens = value.prefilledQueens;
  const gridRecord = grid && typeof grid === "object" && !Array.isArray(grid) ? grid : null;
  const rows = gridRecord && (gridRecord as Record<string, unknown>).rows;
  const columns = gridRecord && (gridRecord as Record<string, unknown>).columns;
  const boardGrid = isQueensBoardSize(rows) && rows === columns ? queensGrid(rows) : null;
  const cellCount = boardGrid ? queensCellCount(boardGrid) : 0;
  const rawProgress =
    progress && typeof progress === "object" && !Array.isArray(progress)
      ? (progress as Record<string, unknown>)
      : {};
  const validCells = (candidate: unknown): candidate is number[] =>
    Array.isArray(candidate) &&
    candidate.every(
      (cell) => Number.isSafeInteger(cell) && Number(cell) >= 0 && Number(cell) < cellCount,
    ) &&
    new Set(candidate).size === candidate.length;
  const queens = validCells(rawProgress.queens)
    ? rawProgress.queens
    : validCells(prefilledQueens)
      ? prefilledQueens
      : [];
  const safeProgress: ServerQueensProgress = {
    kind: "queens",
    incorrectValidations: Number(rawProgress.incorrectValidations ?? 0),
    maxIncorrectValidations:
      rawProgress.maxIncorrectValidations === undefined ||
      rawProgress.maxIncorrectValidations === null
        ? null
        : Number(rawProgress.maxIncorrectValidations),
    queens,
    placedQueens: Number(rawProgress.placedQueens ?? queens.length),
    completedRows: Number(rawProgress.completedRows ?? 0),
    completedColumns: Number(rawProgress.completedColumns ?? 0),
    completedRegions: Number(rawProgress.completedRegions ?? 0),
    conflictingQueens: Number(rawProgress.conflictingQueens ?? 0),
    solved: rawProgress.solved === true,
  };
  if (
    !grid ||
    typeof grid !== "object" ||
    Array.isArray(grid) ||
    !boardGrid ||
    !Array.isArray(regions) ||
    regions.length !== cellCount ||
    !regions.every(
      (region) =>
        Number.isSafeInteger(region) && Number(region) >= 0 && Number(region) < boardGrid.rows,
    ) ||
    !validCells(prefilledQueens) ||
    !validCells(queens) ||
    safeProgress.placedQueens !== queens.length ||
    ![
      safeProgress.incorrectValidations,
      safeProgress.placedQueens,
      safeProgress.completedRows,
      safeProgress.completedColumns,
      safeProgress.completedRegions,
      safeProgress.conflictingQueens,
    ].every((metric) => Number.isSafeInteger(metric) && metric >= 0) ||
    (safeProgress.maxIncorrectValidations !== null &&
      safeProgress.maxIncorrectValidations !== QUEENS_PYRAMID_MAX_INCORRECT_VALIDATIONS) ||
    safeProgress.completedRows > boardGrid.rows ||
    safeProgress.completedColumns > boardGrid.columns ||
    safeProgress.completedRegions > boardGrid.rows
  ) {
    throw new ServerFlashQuestionError();
  }
  return {
    ...base,
    type: "queens",
    grid: boardGrid,
    regions,
    prefilledQueens,
    progress: safeProgress,
  };
}
export function validatePublic(context: PublicReadContext) {
  return validationResult("publicPayload", () => readPublic(context));
}
