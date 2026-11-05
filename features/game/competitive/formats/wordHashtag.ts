import { wordHashtagState } from "@/lib/competitiveResponseContract";
import type { SessionQuestion } from "../core/sessionReducer";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import { evaluated, type FormatOutcome } from "./types";
export function wordHashtagOutcome(
  question: SessionQuestion,
  fromCell: number,
  toCell: number,
  response: AuthoritativeSessionUpdate,
): FormatOutcome {
  if (question.type !== "word-hashtag") throw new Error("unexpected_question_format");
  const terminal = response.terminal;
  wordHashtagState(response, question.maxMoves);
  const swaps = [...question.progress.swaps, { fromCell, toCell }];
  const next = {
    ...question,
    progress: {
      kind: "word-hashtag" as const,
      letters: [...response.letters],
      correctCells: [...response.correctCells],
      swaps,
      movesUsed: response.movesUsed,
      movesRemaining: response.movesRemaining,
    },
  };
  return terminal === true
    ? evaluated(next, { swaps }, response)
    : { kind: "progress", question: next };
}
