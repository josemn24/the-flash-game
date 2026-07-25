import type { Question } from "@/types/question";
import type { QuestionId } from "@/data/questions";

export type GameMode = "flash" | "alphabet";

export type ChallengeDefinitionId = string;
export type ChallengeAvailabilityStatus = "available" | "locked" | "expired";
export type ChallengeQuestionPoints = Partial<Record<string, number>>;

type ChallengeDefinitionBase = {
  id: ChallengeDefinitionId;
  title: string;
  subtitle: string;
  description: string;
};

export type FlashChallengeDefinition = ChallengeDefinitionBase & {
  mode: "flash";
  questionIds: QuestionId[];
  questionPoints?: ChallengeQuestionPoints;
};

export type AlphabetChallengeDefinitionEntry = {
  letter: string;
  questionId: QuestionId;
};

export type AlphabetChallengeDefinition = ChallengeDefinitionBase & {
  mode: "alphabet";
  timeLimit: number;
  entries: AlphabetChallengeDefinitionEntry[];
};

export type ChallengeDefinition = FlashChallengeDefinition | AlphabetChallengeDefinition;

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

type ChallengeBase = {
  id: string;
  definitionId: ChallengeDefinitionId;
  number: number;
  title: string;
  subtitle: string;
  description: string;
};

export type FlashChallenge = ChallengeBase & {
  mode: "flash";
  questions: Question[];
  questionPoints?: ChallengeQuestionPoints;
};

export type AlphabetChallengeEntry = {
  letter: string;
  question: Question;
};

export type AlphabetChallenge = ChallengeBase & {
  mode: "alphabet";
  timeLimit: number;
  entries: AlphabetChallengeEntry[];
};

export type Challenge = FlashChallenge | AlphabetChallenge;

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
