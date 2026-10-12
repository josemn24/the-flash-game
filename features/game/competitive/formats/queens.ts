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
      incorrectValidations: Number(
        response.incorrectValidations ?? question.progress.incorrectValidations,
      ),
      maxIncorrectValidations:
        response.maxIncorrectValidations === undefined
          ? question.progress.maxIncorrectValidations
          : response.maxIncorrectValidations === null
            ? null
            : Number(response.maxIncorrectValidations),
      queens,
      placedQueens: Number(response.placedQueens),
      completedRows: Number(response.completedRows),
      completedColumns: Number(response.completedColumns),
      completedRegions: Number(response.completedRegions),
      conflictingQueens: Number(response.conflictingQueens),
      solved: response.solved === true,
    },
  };
  const remaining =
    next.progress.maxIncorrectValidations === null
      ? null
      : Math.max(0, next.progress.maxIncorrectValidations - next.progress.incorrectValidations);
  return response.terminal === true
    ? evaluated(next, { queens, marks: [] }, response)
    : {
        kind: "progress",
        question: next,
        message: draft
          ? undefined
          : remaining === null
            ? "El tablero no es correcto. Revisa las coronas en conflicto y continúa."
            : `El tablero no es correcto. ${remaining === 1 ? "1 intento restante · Último intento" : `${remaining} intentos restantes`}. Revisa las coronas y continúa.`,
      };
}
