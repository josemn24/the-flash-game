import type {
  AttemptAnswerId,
  AttemptId,
  ChallengeItemId,
  PlayerId,
  ScheduledChallengeId,
} from "@/types/domain/identifiers";
import type { DurationMs, JsonValue, UtcIsoDateTime } from "@/types/domain/values";
import type { GameMode } from "@/types/domain/content";

export type AttemptStatus = "in_progress" | "completed" | "abandoned" | "invalidated";
export type SurvivalAttemptOutcome = "survived" | "eliminated";
export type PyramidAttemptOutcome = "summit" | "failed";
export type AttemptOutcome = SurvivalAttemptOutcome | PyramidAttemptOutcome | null;
export type AttemptOutcomeByMode = {
  readonly flash: null;
  readonly alphabet: null;
  readonly narrative: null;
  readonly survival: SurvivalAttemptOutcome;
  readonly pyramid: PyramidAttemptOutcome;
};

/** Mode comes from the immutable challenge version, never a second persisted column. */
export type AttemptLifecycle = {
  [Mode in GameMode]: { readonly challengeMode: Mode } & (
    | { readonly status: "in_progress"; readonly outcome: null }
    | { readonly status: "abandoned"; readonly outcome: null }
    | { readonly status: "completed"; readonly outcome: AttemptOutcomeByMode[Mode] }
    | { readonly status: "invalidated"; readonly outcome: AttemptOutcomeByMode[Mode] | null }
  );
}[GameMode];
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
  readonly deadlineAt: UtcIsoDateTime | null;
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
