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
import type { MiniWordleLetterFeedback } from "@/types/domain/mini-wordle";

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
  readonly payloadSchemaVersion: number;
  readonly publicPayload: JsonValue | null;
  readonly presentedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime;
  readonly timedOut: boolean;
  /** Safe progress only; never contains a solution payload. */
  readonly progress?: JsonValue | null;
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
export type MatchingPair = {
  readonly leftId: string;
  readonly rightId: string;
};
export type SubmitMatchingPairInput = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
  readonly leftItemId: string;
  readonly rightItemId: string;
  readonly clientTimeUsedMs?: DurationMs;
};
export type SubmitMatchingPairResult = AttemptCommandResult & {
  readonly challengeItemId: ChallengeItemId;
  readonly leftItemId: string;
  readonly rightItemId: string;
  readonly correct: boolean;
  readonly terminal: boolean;
  readonly matchedPairs: readonly MatchingPair[];
  readonly matchedCount: number;
  readonly totalPairs: number;
  readonly incorrectAttempts: number;
  readonly penaltyPoints: number;
  readonly receiptId?: AnswerReceiptId;
  readonly status?: AnswerStatus;
  readonly points?: number;
  readonly timeUsedMs?: DurationMs;
};
export type SubmitMiniWordleGuessInput = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
  readonly guess: string;
  readonly clientTimeUsedMs?: DurationMs;
};
export type SubmitMiniWordleGuessResult = AttemptCommandResult & {
  readonly challengeItemId: ChallengeItemId;
  readonly sequence: number;
  readonly guess: string;
  readonly feedback: readonly MiniWordleLetterFeedback[];
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
  readonly terminal: boolean;
  readonly receiptId?: AnswerReceiptId;
  /** Present only after the trusted evaluator has recorded the final receipt. */
  readonly status?: AnswerStatus;
  readonly points?: number;
  readonly timeUsedMs?: DurationMs;
};
export type SubmitLogicCodeAttemptInput = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
  readonly code: string;
  readonly clientTimeUsedMs?: DurationMs;
};
export type SubmitLogicCodeAttemptResult = AttemptCommandResult & {
  readonly challengeItemId: ChallengeItemId;
  readonly sequence: number;
  readonly code: string;
  readonly correct: boolean;
  readonly incorrectAttempts: number;
  readonly terminal: boolean;
  readonly receiptId?: AnswerReceiptId;
  readonly status?: AnswerStatus;
  readonly points?: number;
  readonly timeUsedMs?: DurationMs;
};
export type RevealProgressiveClueInput = AttemptCommandInput & {
  readonly challengeItemId: ChallengeItemId;
};
export type RevealProgressiveClueResult = AttemptCommandResult & {
  readonly challengeItemId: ChallengeItemId;
  readonly clueIndex: number;
  readonly clue: string;
  readonly revealedClues: number;
  readonly totalClues: number;
  readonly availablePoints: number;
  readonly cluePenalty: number;
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
/** Reserved for a post-MVP multi-device policy; the current command is deliberately disabled. */
export type TakeOverAttemptResult = AttemptCommandResult & {
  readonly sessionId: AttemptSessionId;
  readonly deadlineAt: UtcIsoDateTime | null;
};
export type CompleteAttemptInput = AttemptCommandInput;
/** Recovery is server initiated after the original HttpOnly session is restored. */
export type RecoverAttemptInput = AttemptCommandInput;
export type RecoverAttemptResult = AttemptCommandResult & {
  readonly receiptId: AnswerReceiptId | null;
  readonly recovered: boolean;
  readonly preserved?: boolean;
};
export type AttemptRecoveryAnswer = {
  readonly challengeItemId: ChallengeItemId;
  readonly status: AnswerStatus;
  readonly answer: JsonValue;
  readonly points: number;
  readonly timeUsedMs: DurationMs;
};
/** Deliberately excludes question public/solution payloads. */
export type AttemptRecoverySnapshot = {
  readonly attemptId: AttemptId;
  readonly scheduledChallengeId: ScheduledChallengeId;
  readonly status: AttemptStatus;
  readonly lockVersion: number;
  readonly hasStartedInteraction: boolean;
  readonly allItemsResolved: boolean;
  readonly answers: readonly AttemptRecoveryAnswer[];
};
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
