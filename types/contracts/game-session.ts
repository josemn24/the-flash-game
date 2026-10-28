import type { GameSessionErrorCode } from "@/types/contracts/competitive-errors";
import type { AnswerValue } from "@/types/contracts/questions";

/** A provider-owned revision. Consumers only retain and replay it. */
export type SessionRevision = number;
export type SessionCommandContext = {
  readonly sessionId: string;
  readonly revision: SessionRevision;
};
type Mutation = SessionCommandContext & { readonly idempotencyKey: string };
type Interaction = Mutation & { readonly challengeItemId: string };

export type GameSessionCommandInputs = {
  prepareSession: { readonly challengeId: string };
  start: { readonly challengeId: string; readonly idempotencyKey: string };
  takeover: Mutation & { readonly challengeId: string };
  recover: SessionCommandContext;
  prepare: Mutation;
  activate: Interaction;
  answer: Interaction & { readonly answer: AnswerValue | null };
  alphabetPass: Interaction;
  complete: Mutation;
  abandon: SessionCommandContext;
  miniWordleGuess: Interaction & { readonly guess: string };
  logicCodeAttempt: Interaction & { readonly code: string };
  wordHashtagSwap: Interaction & { readonly fromCell: number; readonly toCell: number };
  progressiveClueReveal: Interaction;
  queensDraft: Interaction & { readonly queens: readonly number[] };
  queensValidation: Interaction & { readonly queens: readonly number[] };
  wordSearchSelection: Interaction & { readonly startCell: number; readonly endCell: number };
};
export type GameSessionOperation = keyof GameSessionCommandInputs;
/** Preserve this entire value, including revision and key, when replaying. */
export type GameSessionCommand = {
  [K in GameSessionOperation]: {
    readonly operation: K;
    readonly input: GameSessionCommandInputs[K];
  };
}[GameSessionOperation];

/** No HTTP status, cookies, database rows or transport exceptions cross the port. */
export type GameSessionFailure = {
  readonly kind: "rejected" | "uncertain";
  readonly code: GameSessionErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly authorizationLost?: boolean;
  readonly controlRequired?: SessionCommandContext & { readonly deadlineAt: string | null };
};
