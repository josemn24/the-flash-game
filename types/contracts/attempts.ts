import type { AnswerStatus } from "@/types/domain/attempt";
import type { AttemptId, ChallengeItemId, ScheduledChallengeId } from "@/types/domain/identifiers";
import type { DurationMs, JsonValue, UtcIsoDateTime } from "@/types/domain/values";
import type { AnswerValueOfType, QuestionType } from "@/types/contracts/questions";

export type StartAttemptInput = {
  readonly scheduledChallengeId: ScheduledChallengeId;
  readonly idempotencyKey: string;
};

export type StartAttemptResult = {
  readonly attemptId: AttemptId;
  readonly resumed: boolean;
  readonly deadlineAt: UtcIsoDateTime;
  readonly lockVersion: number;
};

export type SubmitAnswerInput<Type extends QuestionType = QuestionType> = {
  readonly attemptId: AttemptId;
  readonly challengeItemId: ChallengeItemId;
  readonly questionType: Type;
  readonly answer: AnswerValueOfType<Type> | null;
  readonly clientTimeUsedMs: DurationMs;
  readonly lockVersion: number;
  readonly idempotencyKey: string;
};

export type SubmitAnswerResult = {
  readonly status: AnswerStatus;
  readonly points: number;
  readonly resultDetails: JsonValue | null;
  readonly nextLockVersion: number;
};
