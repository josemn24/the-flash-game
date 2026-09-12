import type {
  ChallengeDefinitionId,
  ChallengeItemId,
  ChallengeVersionId,
  PlayerId,
  QuestionDefinitionId,
  QuestionVersionId,
  ScheduledChallengeId,
  SeasonId,
} from "@/types/domain/identifiers";
import type { EntityTimestamps, JsonValue, UtcIsoDateTime } from "@/types/domain/values";

export type GameMode = "flash" | "alphabet" | "survival" | "narrative" | "pyramid";
export type ContentStatus = "draft" | "published" | "archived";
export type PublicationStatus = "scheduled" | "open" | "closed" | "cancelled";

export type QuestionTagSet = {
  readonly domains: readonly string[];
  readonly topics: readonly string[];
  readonly cognitiveSkills: readonly string[];
  readonly formatSkills: readonly string[];
  readonly lifeSkills: readonly string[];
};

export type ChallengeDefinition = EntityTimestamps & {
  readonly id: ChallengeDefinitionId;
  readonly slug: string;
  readonly createdByPlayerId: PlayerId;
  readonly archivedAt: UtcIsoDateTime | null;
};

export type ChallengeVersion = EntityTimestamps & {
  readonly id: ChallengeVersionId;
  readonly challengeDefinitionId: ChallengeDefinitionId;
  readonly versionNumber: number;
  readonly status: ContentStatus;
  readonly mode: GameMode;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly maxScore: 100;
  readonly modeConfig: JsonValue;
  readonly createdByPlayerId: PlayerId;
  readonly publishedAt: UtcIsoDateTime | null;
};

export type ChallengeItem = EntityTimestamps & {
  readonly id: ChallengeItemId;
  readonly challengeVersionId: ChallengeVersionId;
  readonly questionVersionId: QuestionVersionId;
  readonly position: number;
  readonly points: number;
  readonly modeConfig: JsonValue;
};

export type QuestionDefinition = EntityTimestamps & {
  readonly id: QuestionDefinitionId;
  readonly slug: string;
  readonly createdByPlayerId: PlayerId;
  readonly archivedAt: UtcIsoDateTime | null;
};

export type QuestionVersion<
  Type extends string = string,
  PublicPayload = JsonValue,
  SolutionPayload = JsonValue,
> = EntityTimestamps & {
  readonly id: QuestionVersionId;
  readonly questionDefinitionId: QuestionDefinitionId;
  readonly versionNumber: number;
  readonly status: ContentStatus;
  readonly type: Type;
  readonly publicPayload: PublicPayload;
  readonly solutionPayload: SolutionPayload;
  readonly createdByPlayerId: PlayerId;
  readonly publishedAt: UtcIsoDateTime | null;
};

export type ScheduledChallenge = EntityTimestamps & {
  readonly id: ScheduledChallengeId;
  readonly seasonId: SeasonId;
  readonly challengeVersionId: ChallengeVersionId;
  readonly number: number;
  readonly status: PublicationStatus;
  readonly opensAt: UtcIsoDateTime;
  readonly closesAt: UtcIsoDateTime;
  readonly cancelledAt: UtcIsoDateTime | null;
  readonly resultsLockedAt: UtcIsoDateTime | null;
};
