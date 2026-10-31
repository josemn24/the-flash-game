import type { AnswerValue } from "@/types/contracts";
import type { AnswerResult } from "@/types/gameplay/result";
import type {
  SessionQuestion,
  SessionState,
  PendingCommand,
  FeedbackChannel,
} from "../core/sessionReducer";
import type { AuthoritativeSessionUpdate } from "@/types/gameplay/authoritative-session";
export type FormatOutcome =
  | {
      kind: "progress";
      question: SessionQuestion;
      message?: string;
      selection?: SessionState["lastWordSearchSelection"];
    }
  | { kind: "evaluated"; result: AnswerResult; question: SessionQuestion };
export type FormatAction =
  | { kind: "answer"; answer: AnswerValue | null }
  | { kind: "mini-wordle"; guess: string }
  | { kind: "logic-code"; code: string }
  | { kind: "word-hashtag"; fromCell: number; toCell: number }
  | { kind: "reveal" }
  | { kind: "queens-draft" | "queens-validation"; queens: readonly number[] }
  | { kind: "word-search"; startCell: number; endCell: number };
export type InteractionOperation =
  | "answer"
  | "miniWordleGuess"
  | "logicCodeAttempt"
  | "wordHashtagSwap"
  | "progressiveClueReveal"
  | "queensDraft"
  | "queensValidation"
  | "wordSearchSelection";
export type InteractionSpec = {
  [K in InteractionOperation]: {
    operation: K;
    data: Omit<
      Extract<PendingCommand, { operation: K }>["input"],
      "sessionId" | "revision" | "idempotencyKey"
    >;
    channel?: FeedbackChannel;
  };
}[InteractionOperation];
export function evaluated(
  question: SessionQuestion,
  answer: AnswerValue | null,
  response: AuthoritativeSessionUpdate,
): FormatOutcome {
  const status = response.status;
  if (
    status !== "correct" &&
    status !== "partial" &&
    status !== "incorrect" &&
    status !== "unanswered"
  )
    throw new Error("invalid_answer_response");
  if (
    typeof response.points !== "number" ||
    !Number.isFinite(response.points) ||
    typeof response.timeUsedMs !== "number" ||
    !Number.isFinite(response.timeUsedMs)
  )
    throw new Error("invalid_answer_response");
  return {
    kind: "evaluated",
    question,
    result: {
      questionId: question.id,
      answer,
      status,
      isCorrect: status === "correct" || status === "partial",
      points: response.points,
      timeUsed: response.timeUsedMs / 1000,
      ...(response.details ? { details: response.details as AnswerResult["details"] } : {}),
      ...(response.reviewState ? { reviewState: response.reviewState } : {}),
    },
  };
}
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
export const numbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => Number.isSafeInteger(item)) : [];
