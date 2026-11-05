import type { SessionQuestion } from "../core/sessionReducer";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import type { FormatOutcome } from "./types";
export function progressiveCluesOutcome(
  question: SessionQuestion,
  response: AuthoritativeSessionUpdate,
): FormatOutcome {
  if (question.type !== "progressive-clues") throw new Error("unexpected_question_format");
  const clues = [...question.clues, String(response.clue)];
  const totalClues = Number(response.totalClues);
  const cluePenalty = Number(response.cluePenalty);
  return {
    kind: "progress",
    question: {
      ...question,
      clues,
      totalClues,
      cluePenalty,
      progress: {
        kind: "progressive-clues",
        clues,
        revealedClues: Number(response.revealedClues),
        totalClues,
        cluePenalty,
        availablePoints: Number(response.availablePoints),
      },
    },
  };
}
