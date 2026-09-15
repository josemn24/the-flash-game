import type {
  AcceptInvitationInput,
  AcceptInvitationResult,
  AttemptCommandInput,
  AttemptCommandResult,
  CompleteAttemptInput,
  FinishAttemptResult,
  PassInteractionInput,
  PassInteractionResult,
  PrepareInteractionInput,
  PrepareInteractionResult,
  ReceiveAnswerResult,
  StartAttemptInput,
  StartAttemptResult,
  SubmitAnswerInput,
  SubmitAnswerResult,
  TakeOverAttemptInput,
  TakeOverAttemptResult,
} from "@/types/contracts/attempts";
import type { AnswerStatus } from "@/types/domain/attempt";
import type { AnswerReceiptId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue, UtcIsoDateTime } from "@/types/domain/values";
import type { QuestionType } from "@/types/contracts/questions";
import type { GameMode } from "@/types/domain/content";

/** Internal only: created by the adapter using cryptographic randomness, never a player ID. */
export type StartAttemptCommand = StartAttemptInput & { readonly sessionToken: string };
/** Reserved for a post-MVP multi-device policy; no current application flow may invoke it. */
export type TakeOverAttemptCommand = TakeOverAttemptInput & { readonly newSessionToken: string };
/** Only the trusted evaluator can provide status/points. Not a browser input contract. */
export type RecordEvaluationCommand = AttemptCommandInput & {
  readonly receiptId: AnswerReceiptId;
  readonly status: AnswerStatus;
  readonly points: number;
  readonly resultDetails?: JsonValue;
};
/** The existing mode evaluator supplies the authoritative termination/normalization decision. */
export type CompleteAttemptCommand = CompleteAttemptInput & {
  readonly score: number;
  readonly outcome?: string;
};
export type InvalidateAttemptCommand = TakeOverAttemptInput & { readonly reason: string };
export type AdjustResultCommand = InvalidateAttemptCommand & { readonly score: number };
export type AdministrativeResult = AttemptCommandResult & {
  readonly status: "completed" | "invalidated";
  readonly effectiveScore: number;
};
export type EvaluationReceipt = {
  readonly receiptId: AnswerReceiptId;
  readonly answer: JsonValue;
  readonly receivedAt: UtcIsoDateTime;
  readonly timeUsedMs: DurationMs;
  readonly timedOut: boolean;
};
/** Private content; the adapter validates each format before assembling the legacy evaluator input. */
export type EvaluationContext = EvaluationReceipt & {
  readonly questionType: QuestionType;
  readonly payloadSchemaVersion: number;
  readonly itemConfigSchemaVersion: number;
  readonly publicPayload: JsonValue;
  readonly solutionPayload: JsonValue;
  readonly timeLimitMs: DurationMs;
  readonly itemPoints: number;
  readonly itemConfig: JsonValue;
  readonly mode: GameMode;
  readonly modeConfigSchemaVersion: number;
  readonly modeConfig: JsonValue;
};

/**
 * Each method is one PostgreSQL transaction. receiveAnswer commits BEFORE evaluation;
 * recordEvaluation uses the persisted receipt even if the evaluator is slow or retried.
 * The adapter must verify Auth, SET LOCAL claims and use service_role, then always commit/rollback.
 * There is deliberately no insert/update/delete escape hatch.
 */
export interface AttemptCommands {
  start(input: StartAttemptCommand): Promise<StartAttemptResult>;
  /** Reserved for a post-MVP multi-device policy; the database rejects it in the MVP. */
  takeOver(input: TakeOverAttemptCommand): Promise<TakeOverAttemptResult>;
  prepare(input: PrepareInteractionInput): Promise<PrepareInteractionResult>;
  receiveAnswer(input: SubmitAnswerInput): Promise<ReceiveAnswerResult>;
  readEvaluationContext(
    receiptId: AnswerReceiptId,
    sessionToken: string,
  ): Promise<EvaluationContext>;
  pass(input: PassInteractionInput): Promise<PassInteractionResult>;
  recordEvaluation(input: RecordEvaluationCommand): Promise<SubmitAnswerResult>;
  complete(input: CompleteAttemptCommand): Promise<FinishAttemptResult>;
  abandon(input: AttemptCommandInput): Promise<FinishAttemptResult>;
  acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult>;
  invalidate(input: InvalidateAttemptCommand): Promise<AdministrativeResult>;
  adjust(input: AdjustResultCommand): Promise<AdministrativeResult>;
}
export type CommandErrorCode =
  | "not_authorized"
  | "session_revoked"
  | "stale_version"
  | "idempotency_conflict"
  | "invalid_command"
  | "attempt_terminal"
  | "interaction_not_presented"
  | "evaluation_pending"
  | "publication_cancelled"
  | "invitation_unavailable";
