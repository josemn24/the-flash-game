import type {
  LegacyRoomMember,
  LegacyRoomSnapshot,
  LegacySeasonSnapshot,
  LegacySeasonStatus,
} from "@/types/legacy/room";

export type {
  AlphabetAnswerReview,
  AnswerReview,
  ChallengeCompletion,
  ChallengeCompletionInput,
  ChallengeCompletionResult,
  RoomChallengeAttempt,
  RoomChallengeResult,
} from "@/types/gameplay/completion";
export type {
  GameRoomContext,
  CompetitiveAttemptStatus,
  RoomCardModel,
  RoomDailyLeaderboardEntry,
  RoomDetailModel,
  RoomHistoryEntry,
  RoomHistoryResult,
  RoomLeaderboardEntry,
  RoomMemberDetailModel,
  RoomMemberViewModel,
  RoomSettingsModel,
} from "@/types/view-models/room";

/** @deprecated Usa `LegacyRoomSnapshot` o las entidades de `@/types/domain`. */
export type Room = LegacyRoomSnapshot;
/** @deprecated Usa `LegacySeasonSnapshot` o `Season` de `@/types/domain`. */
export type Season = LegacySeasonSnapshot;
/** @deprecated Usa `LegacyRoomMember` o `RoomMembership` de `@/types/domain`. */
export type RoomMember = LegacyRoomMember;
/** @deprecated Estado reducido del snapshot mock; usa `SeasonStatus` de `@/types/domain`. */
export type SeasonStatus = LegacySeasonStatus;
