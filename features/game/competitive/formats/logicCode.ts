import type { SessionQuestion } from "../core/sessionReducer";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
import { evaluated, type FormatOutcome } from "./types";
export function logicCodeOutcome(
  question: SessionQuestion,
  code: string,
  response: AuthoritativeSessionUpdate,
): FormatOutcome {
  if (question.type !== "logic-code") throw new Error("unexpected_question_format");
  const accepted = String(response.code ?? code);
  const next = {
    ...question,
    progress: {
      ...question.progress,
      submittedCodes: [...question.progress.submittedCodes, accepted],
      incorrectAttempts: Number(response.incorrectAttempts),
    },
  };
  return response.terminal === true
    ? evaluated(next, accepted, response)
    : { kind: "progress", question: next };
}
