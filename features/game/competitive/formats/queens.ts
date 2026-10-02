import type { SessionQuestion } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { evaluated, numbers, type FormatOutcome } from "./types";
export function queensOutcome(
  question: SessionQuestion,
  response: CompetitiveJsonObject,
  draft: boolean,
): FormatOutcome {
  if (question.type !== "queens") throw new Error("unexpected_question_format");
  const queens = numbers(response.queens);
  const next = {
    ...question,
    progress: {
      kind: "queens" as const,
      queens,
      placedQueens: Number(response.placedQueens),
      completedRows: Number(response.completedRows),
      completedColumns: Number(response.completedColumns),
      completedRegions: Number(response.completedRegions),
      conflictingQueens: Number(response.conflictingQueens),
      solved: response.solved === true,
    },
  };
  return response.terminal === true
    ? evaluated(next, { queens, marks: [] }, response)
    : {
        kind: "progress",
        question: next,
        message: draft
          ? undefined
          : "El tablero no es correcto. Revisa las coronas en conflicto y continúa.",
      };
}
