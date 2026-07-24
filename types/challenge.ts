import type { Question } from "@/types/question";
import type { QuestionId } from "@/data/questions";

export type GameMode = "flash";

export type ChallengeDefinitionId = string;
export type ChallengeAvailabilityStatus = "available" | "locked" | "expired";

export type ChallengeDefinition = {
  id: ChallengeDefinitionId;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questionIds: QuestionId[];
};

export type PlayableScheduledChallenge = {
  id: string;
  number: number;
  seasonId: string;
  challengeDefinitionId: ChallengeDefinitionId;
  availableFrom: string;
  availableUntil: string;
};

export type PlaceholderScheduledChallenge = {
  id: string;
  number: number;
  seasonId: string;
  challengeDefinitionId?: never;
  title: string;
  subtitle: string;
  mode?: GameMode;
  availableFrom: string;
  availableUntil: string;
};

export type ScheduledChallenge = PlayableScheduledChallenge | PlaceholderScheduledChallenge;

export type Challenge = {
  id: string;
  definitionId: ChallengeDefinitionId;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  mode: GameMode;
  questions: Question[];
};

export type ChallengeSummary = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  mode?: GameMode;
  questionCount: number;
  availableFrom: string;
  availableUntil: string;
  availabilityStatus: ChallengeAvailabilityStatus;
  playable: boolean;
};
