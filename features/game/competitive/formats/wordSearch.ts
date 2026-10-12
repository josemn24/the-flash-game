import type { SessionQuestion } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { evaluated, strings, type FormatOutcome } from "./types";
export function wordSearchOutcome(
  question: SessionQuestion,
  startCell: number,
  endCell: number,
  response: CompetitiveJsonObject,
): FormatOutcome {
  if (question.type !== "word-search") throw new Error("unexpected_question_format");
  const foundSelections = Array.isArray(response.foundSelections)
    ? response.foundSelections.filter(
        (item): item is { targetId: string; startCell: number; endCell: number } =>
          item &&
          typeof item === "object" &&
          typeof item.targetId === "string" &&
          Number.isSafeInteger(item.startCell) &&
          Number.isSafeInteger(item.endCell),
      )
    : [];
  const foundWordIds = Array.isArray(response.foundWordIds)
    ? strings(response.foundWordIds)
    : foundSelections.map((item) => item.targetId);
  const next = {
    ...question,
    progress: {
      kind: "word-search" as const,
      foundSelections,
      foundWordIds,
      foundCount: Number(response.foundCount),
      totalWords: Number(response.totalWords),
      incorrectAttempts: Number(response.incorrectAttempts),
    },
  };
  return response.terminal === true
    ? evaluated(next, { foundWordIds }, response)
    : {
        kind: "progress",
        question: next,
        selection: { startCell, endCell, correct: response.correct === true },
      };
}
