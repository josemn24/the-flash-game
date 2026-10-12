import { isQueensBoardSize, queensCellCount, queensGrid } from "@/lib/queens";
import type { StoredQuestionMap } from "@/types/contracts/stored-questions";
import { storedPublicEnvelope, type StoredPublicContext } from "../stored-common";
import { FormatValidationError, validationResult } from "../types";
import { definition } from "./definition";
export function validateStoredPublic(input: unknown, context: StoredPublicContext) {
  return validationResult("publicPayload", () => {
    const publicPayload = storedPublicEnvelope(input, context, definition);
    const grid = publicPayload.grid;
    const regions = publicPayload.regions;
    const prefilledQueens = publicPayload.prefilledQueens;
    const gridRecord = grid && typeof grid === "object" && !Array.isArray(grid) ? grid : null;
    const rows = gridRecord && (gridRecord as Record<string, unknown>).rows;
    const columns = gridRecord && (gridRecord as Record<string, unknown>).columns;
    const boardGrid = isQueensBoardSize(rows) && rows === columns ? queensGrid(rows) : null;
    const cellCount = boardGrid ? queensCellCount(boardGrid) : 0;
    if (!grid) throw new FormatValidationError("invalid_question_payload");
    if (typeof grid !== "object") throw new FormatValidationError("invalid_question_payload");
    if (Array.isArray(grid)) throw new FormatValidationError("invalid_question_payload");
    if (!boardGrid) throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(regions)) throw new FormatValidationError("invalid_question_payload");
    if (regions.length !== cellCount) throw new FormatValidationError("invalid_question_payload");
    if (
      !regions.every(
        (region) =>
          typeof region === "number" &&
          Number.isSafeInteger(region) &&
          region >= 0 &&
          region < boardGrid.rows,
      )
    )
      throw new FormatValidationError("invalid_question_payload");
    if (!Array.isArray(prefilledQueens))
      throw new FormatValidationError("invalid_question_payload");
    if (
      !prefilledQueens.every(
        (cell) =>
          typeof cell === "number" && Number.isSafeInteger(cell) && cell >= 0 && cell < cellCount,
      )
    )
      throw new FormatValidationError("invalid_question_payload");
    return publicPayload as StoredQuestionMap["queens"]["publicPayload"];
  });
}
