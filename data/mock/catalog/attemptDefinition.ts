import type { QuestionSlug } from "@/data/mock/catalog/questions";
import type {
  AnswerStatus,
  AttemptKind,
  AttemptOutcome,
  AttemptStatus,
  JsonValue,
} from "@/types/domain";
import type { PlayerRouteKey, ScheduledChallengeRouteKey } from "@/data/mock/constants";

export type MockAttemptAnswerFixture = {
  readonly questionSlug: QuestionSlug;
  readonly status: AnswerStatus;
  readonly answer: JsonValue | null;
  readonly resultDetails: JsonValue | null;
  readonly points: number;
  readonly presentedAt: string;
  readonly submittedAt: string | null;
  readonly timeUsedMs: number;
};

export type MockAttemptFixture = {
  readonly scheduledChallengeKey: ScheduledChallengeRouteKey;
  readonly playerKey: PlayerRouteKey;
  readonly attemptNumber: number;
  readonly kind: AttemptKind;
  readonly status: AttemptStatus;
  readonly outcome: AttemptOutcome;
  readonly startedAt: string;
  readonly deadlineAt: string;
  readonly completedAt: string | null;
  readonly score: number | null;
  readonly clientStateSchemaVersion: number;
  readonly lockVersion: number;
  readonly progressPayload: JsonValue | null;
  readonly answers: readonly MockAttemptAnswerFixture[];
};

export function defineAttemptCatalog<const Catalog extends readonly MockAttemptFixture[]>(
  catalog: Catalog,
) {
  return catalog;
}
