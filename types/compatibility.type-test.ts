import type {
  AnswerResult,
  AnswerReview,
  Challenge,
  ChallengeCompletion,
  ChallengeDefinition,
  ChallengeSummary,
  GamePhase,
  Question,
  Room,
  RoomCardModel,
  RoomDetailModel,
  RoomMember,
  RoomMemberDetailModel,
  RoomSettingsModel,
  Season,
  UserProfile,
} from "@/types/game";

export type LegacyBarrelAssertions =
  | AnswerResult
  | AnswerReview
  | Challenge
  | ChallengeCompletion
  | ChallengeDefinition
  | ChallengeSummary
  | GamePhase
  | Question
  | Room
  | RoomCardModel
  | RoomDetailModel
  | RoomMember
  | RoomMemberDetailModel
  | RoomSettingsModel
  | Season
  | UserProfile;
