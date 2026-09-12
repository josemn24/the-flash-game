import type {
  AttemptAnswerId,
  AttemptId,
  ChallengeItemId,
  PlayerId,
  ScheduledChallengeId,
} from "@/types/domain/identifiers";
import type { DurationMs, JsonValue, UtcIsoDateTime } from "@/types/domain/values";

export type AttemptStatus = "in_progress" | "completed" | "abandoned" | "expired" | "invalidated";
export type AttemptOutcome = "passed" | "failed" | null;
export type AttemptKind = "competitive" | "test";
export type AnswerStatus = "correct" | "partial" | "incorrect" | "unanswered" | "timeout";

export type Attempt = {
  readonly id: AttemptId;
  readonly playerId: PlayerId;
  readonly scheduledChallengeId: ScheduledChallengeId;
  readonly attemptNumber: number;
  readonly kind: AttemptKind;
  readonly status: AttemptStatus;
  readonly outcome: AttemptOutcome;
  readonly startedAt: UtcIsoDateTime;
  readonly deadlineAt: UtcIsoDateTime;
  readonly completedAt: UtcIsoDateTime | null;
  readonly score: number | null;
  readonly clientStateSchemaVersion: number;
  readonly lockVersion: number;
  readonly progressPayload: JsonValue | null;
};

export type AttemptAnswer<Answer = JsonValue, Details = JsonValue> = {
  readonly id: AttemptAnswerId;
  readonly attemptId: AttemptId;
  readonly challengeItemId: ChallengeItemId;
  readonly status: AnswerStatus;
  readonly answer: Answer | null;
  readonly resultDetails: Details | null;
  readonly points: number;
  readonly presentedAt: UtcIsoDateTime;
  readonly submittedAt: UtcIsoDateTime | null;
  readonly timeUsedMs: DurationMs;
};
