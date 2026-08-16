import type { Question } from "@/types/question";
import type { QuestionMedia } from "@/types/question";
import type { QuestionId } from "@/data/questions";

export type GameMode = "flash" | "alphabet" | "survival" | "narrative";
export type ChallengeImplementationStatus = "prototype" | "complete";

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

export type SurvivalChallengeDefinition = ChallengeDefinitionBase & {
  mode: "survival";
  lives: number;
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

export type NarrativeTextBlock =
  { type: "narration"; text: string } | { type: "dialogue"; speaker: string; text: string };

export type NarrativeOutcome = "correct" | "incorrect" | "timeout";

export type NarrativeReactionMap = Record<NarrativeOutcome, NarrativeTextBlock[]>;

export type NarrativeScene = {
  id: string;
  eyebrow: string;
  title?: string;
  presentation?: "standard" | "blackout";
  media?: QuestionMedia;
  blocks: NarrativeTextBlock[];
};

export type NarrativeNotebookEntry = {
  id: string;
  text: string;
  relevance: "context" | "potential";
};

export type NarrativeSceneStepDefinition = {
  type: "scene";
  scene: NarrativeScene;
  unlockEntryIds?: string[];
};

export type NarrativeQuestionStepDefinition = {
  type: "question";
  questionId: QuestionId;
  unlockEntryIds: string[];
  reactions: NarrativeReactionMap;
};

export type NarrativeStepDefinition =
  NarrativeSceneStepDefinition | NarrativeQuestionStepDefinition;

export type NarrativeBeatDefinition = {
  id: string;
  title: string;
  steps: NarrativeStepDefinition[];
};

export type NarrativeChallengeDefinition = ChallengeDefinitionBase & {
  mode: "narrative";
  implementationStatus: ChallengeImplementationStatus;
  maxScore: number;
  prologue: NarrativeScene;
  beats: NarrativeBeatDefinition[];
  notebookEntries: NarrativeNotebookEntry[];
  questionPoints: Record<string, number>;
};

export type ChallengeDefinition =
  | FlashChallengeDefinition
  | AlphabetChallengeDefinition
  | SurvivalChallengeDefinition
  | NarrativeChallengeDefinition;

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

export type SurvivalChallenge = ChallengeBase & {
  mode: "survival";
  lives: number;
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

export type NarrativeSceneStep = NarrativeSceneStepDefinition;

export type NarrativeQuestionStep = {
  type: "question";
  question: Question;
  unlockEntryIds: string[];
  reactions: NarrativeReactionMap;
};

export type NarrativeStep = NarrativeSceneStep | NarrativeQuestionStep;

export type NarrativeBeat = {
  id: string;
  title: string;
  steps: NarrativeStep[];
};

export type NarrativeChallenge = ChallengeBase & {
  mode: "narrative";
  implementationStatus: ChallengeImplementationStatus;
  maxScore: number;
  prologue: NarrativeScene;
  beats: NarrativeBeat[];
  notebookEntries: NarrativeNotebookEntry[];
};

export type Challenge = FlashChallenge | AlphabetChallenge | SurvivalChallenge | NarrativeChallenge;

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
  implementationStatus?: ChallengeImplementationStatus;
};
