import type { SessionQuestion } from "../core/sessionReducer";
import type { CompetitiveJsonObject } from "../transport";
import { evaluated, strings, type FormatOutcome } from "./types";
export function miniWordleOutcome(
  question: SessionQuestion,
  response: CompetitiveJsonObject,
): FormatOutcome {
  if (question.type !== "mini-wordle") throw new Error("unexpected_question_format");
  const guesses = Array.isArray(response.guesses)
    ? strings(response.guesses)
    : [...question.progress.guesses, String(response.guess)];
  const next = {
    ...question,
    progress: {
      ...question.progress,
      guesses,
      feedback: [
        ...question.progress.feedback,
        (Array.isArray(response.feedback)
          ? response.feedback
          : []) as (typeof question.progress.feedback)[number],
      ],
      attemptsUsed: Number(response.attemptsUsed),
    },
  };
  return response.terminal === true
    ? evaluated(next, { guesses }, response)
    : { kind: "progress", question: next };
}
