import type { AnswerStatus, AttemptStatus } from "@/types/domain/attempt";
import type {
  AttemptId,
  AttemptSessionId,
  AnswerReceiptId,
  ChallengeItemId,
  ScheduledChallengeId,
  RoomMembershipId,
} from "@/types/domain/identifiers";
import type { DurationMs, JsonValue, UtcIsoDateTime } from "@/types/domain/values";
import type { AnswerValueOfType, QuestionType } from "@/types/contracts/questions";

/** Caller identity always comes from the verified server session, never this input. */
export type StartAttemptInput = {
  readonly scheduledChallengeId: ScheduledChallengeId;
  readonly idempotencyKey: string;
};
export type StartAttemptResult = {
  readonly attemptId: AttemptId;
  readonly sessionId: AttemptSessionId;
  readonly resumed: boolean;
  readonly controlRequired: boolean;
  readonly deadlineAt: UtcIsoDateTime | null;
  readonly lockVersion: number;
};
export type AttemptCommandInput = {
  readonly attemptId: AttemptId;
  readonly sessionToken: string;
  readonly lockVersion: number;
  readonly idempotencyKey: string;
};
export type AttemptCommandResult = {
  readonly attemptId: AttemptId;
  readonly lockVersion: number;
};
export type PrepareInteractionInput = AttemptCommandInput;
export type PrepareInteractionResult = AttemptCommandResult & {
  readonly challengeItemId: ChallengeItemId;
  readonly questionType: QuestionType;
  readonly publicPayload: JsonValue | null;
  readonly presentedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime;
  readonly timedOut: boolean;
};
export type SubmitAnswerInput<Type extends QuestionType = QuestionType> = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
  readonly answer: AnswerValueOfType<Type> | null;
  /** Optional diagnostic telemetry. Never an input to competitive scoring or ranking. */
  readonly clientTimeUsedMs?: DurationMs;
};
export type ReceiveAnswerResult = AttemptCommandResult & {
  readonly receiptId: AnswerReceiptId;
  readonly timedOut: boolean;
  readonly timeUsedMs: DurationMs;
  readonly receivedAt: UtcIsoDateTime;
  readonly presentedAt: UtcIsoDateTime;
};
export type SubmitAnswerResult = AttemptCommandResult & {
  readonly receiptId: AnswerReceiptId;
  readonly status: AnswerStatus;
  readonly points: number;
};
export type PassInteractionInput = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
};
export type PassInteractionResult = AttemptCommandResult & { readonly passed: true };
export type TakeOverAttemptInput = Pick<
  AttemptCommandInput,
  "attemptId" | "lockVersion" | "idempotencyKey"
>;
export type TakeOverAttemptResult = AttemptCommandResult & {
  readonly sessionId: AttemptSessionId;
  readonly deadlineAt: UtcIsoDateTime | null;
};
export type CompleteAttemptInput = AttemptCommandInput;
export type FinishAttemptResult = AttemptCommandResult & {
  readonly status: Extract<AttemptStatus, "completed" | "abandoned">;
  readonly score: number | null;
};
export type AcceptInvitationInput = {
  readonly invitationToken: string;
  readonly idempotencyKey: string;
};
export type AcceptInvitationResult = {
  readonly membershipId: RoomMembershipId;
  readonly joined: boolean;
};
