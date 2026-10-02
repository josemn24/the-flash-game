import { WORD_HASHTAG_ACTIVE_CELLS } from "@/lib/wordHashtag";
import type { SessionQuestion } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { evaluated, numbers, type FormatOutcome } from "./types";
export function wordHashtagOutcome(
  question: SessionQuestion,
  fromCell: number,
  toCell: number,
  response: CompetitiveJsonObject,
): FormatOutcome {
  if (question.type !== "word-hashtag") throw new Error("unexpected_question_format");
  const letters = Array.isArray(response.letters)
    ? response.letters.filter(
        (letter): letter is string | null => letter === null || typeof letter === "string",
      )
    : [];
  const cells = numbers(response.correctCells);
  const valid =
    Array.isArray(response.correctCells) &&
    cells.length === response.correctCells.length &&
    cells.every(
      (cell, index) =>
        WORD_HASHTAG_ACTIVE_CELLS.includes(cell) &&
        letters.length === 25 &&
        letters[cell] !== null &&
        (index === 0 || cells[index - 1]! < cell),
    );
  const swaps = [...question.progress.swaps, { fromCell, toCell }];
  const next = {
    ...question,
    progress: {
      kind: "word-hashtag" as const,
      letters: letters.length === 25 ? letters : question.progress.letters,
      correctCells: valid ? cells : question.progress.correctCells,
      swaps,
      movesUsed: Number(response.movesUsed),
      movesRemaining: Number(response.movesRemaining),
    },
  };
  return response.terminal === true
    ? evaluated(next, { swaps }, response)
    : { kind: "progress", question: next };
}
