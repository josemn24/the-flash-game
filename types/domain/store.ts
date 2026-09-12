import type { Attempt, AttemptAnswer } from "@/types/domain/attempt";
import type {
  ChallengeDefinition,
  ChallengeItem,
  ChallengeVersion,
  QuestionDefinition,
  QuestionVersion,
  ScheduledChallenge,
} from "@/types/domain/content";
import type { Player, PlatformRole } from "@/types/domain/player";
import type { Room, RoomInvitation, RoomMembership } from "@/types/domain/room";
import type { Season } from "@/types/domain/season";

export type PlatformRoleAssignment = {
  readonly playerId: Player["id"];
  readonly role: PlatformRole;
};

export type DomainStore = {
  readonly players: readonly Player[];
  readonly platformRoleAssignments: readonly PlatformRoleAssignment[];
  readonly rooms: readonly Room[];
  readonly roomMemberships: readonly RoomMembership[];
  readonly roomInvitations: readonly RoomInvitation[];
  readonly seasons: readonly Season[];
  readonly challengeDefinitions: readonly ChallengeDefinition[];
  readonly challengeVersions: readonly ChallengeVersion[];
  readonly challengeItems: readonly ChallengeItem[];
  readonly questionDefinitions: readonly QuestionDefinition[];
  readonly questionVersions: readonly QuestionVersion[];
  readonly scheduledChallenges: readonly ScheduledChallenge[];
  readonly attempts: readonly Attempt[];
  readonly attemptAnswers: readonly AttemptAnswer<unknown, unknown>[];
};
