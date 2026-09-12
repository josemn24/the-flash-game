import type { Question, QuestionMedia } from "@/types/question";

export type GameMode = "flash" | "alphabet" | "survival" | "narrative" | "pyramid";
export type ChallengeImplementationStatus = "prototype" | "complete";

/** @deprecated ID legible de los mocks; usa `ChallengeDefinitionId` de `@/types/domain`. */
export type ChallengeDefinitionId = string;
export type ChallengeAvailabilityStatus = "available" | "locked" | "expired";
export type ChallengeQuestionPoints<QuestionId extends string = string> = Partial<
  Record<QuestionId, number>
>;

type ChallengeDefinitionBase = {
  id: ChallengeDefinitionId;
  title: string;
  subtitle: string;
  description: string;
};

export type FlashChallengeDefinition<QuestionId extends string = string> =
  ChallengeDefinitionBase & {
    mode: "flash";
    questionIds: QuestionId[];
    questionPoints?: ChallengeQuestionPoints<QuestionId>;
  };

export type SurvivalChallengeDefinition<QuestionId extends string = string> =
  ChallengeDefinitionBase & {
    mode: "survival";
    lives: number;
    questionIds: QuestionId[];
    questionPoints?: ChallengeQuestionPoints<QuestionId>;
  };

export type AlphabetChallengeDefinitionEntry<QuestionId extends string = string> = {
  letter: string;
  questionId: QuestionId;
};

export type AlphabetChallengeDefinition<QuestionId extends string = string> =
  ChallengeDefinitionBase & {
    mode: "alphabet";
    timeLimit: number;
    entries: AlphabetChallengeDefinitionEntry<QuestionId>[];
  };

export type PyramidLevelDefinition<QuestionId extends string = string> = {
  id: string;
  label: string;
  questionId: QuestionId;
  briefing: PyramidLevelBriefing;
};

export type PyramidLevelBriefing = {
  title: string;
  format: string;
  description: string;
};

export type PyramidChallengeDefinition<QuestionId extends string = string> =
  ChallengeDefinitionBase & {
    mode: "pyramid";
    attemptVersion: number;
    levels: PyramidLevelDefinition<QuestionId>[];
    questionPoints: ChallengeQuestionPoints<QuestionId>;
  };

export type NarrativeTextBlock =
  | { type: "narration"; text: string }
  | { type: "dialogue"; speaker: string; text: string }
  | { type: "emphasis"; text: string };

export type NarrativeOutcome = "correct" | "incorrect" | "timeout";
export type NarrativeReactionMap = Record<NarrativeOutcome, NarrativeTextBlock[]>;

export type NarrativeScene = {
  id: string;
  eyebrow?: string;
  title?: string;
  presentation?:
    "standard" | "chapter-opening" | "full-bleed" | "split" | "text-led" | "artifact" | "blackout";
  media?: QuestionMedia;
  caption?: string;
  advanceLabel?: string;
  blocks: NarrativeTextBlock[];
};

export type NarrativeSceneStepDefinition = {
  type: "scene";
  scene: NarrativeScene;
};

export type NarrativeQuestionStepDefinition<QuestionId extends string = string> = {
  type: "question";
  questionId: QuestionId;
  reactions?: NarrativeReactionMap;
};

export type NarrativeStepDefinition<QuestionId extends string = string> =
  NarrativeSceneStepDefinition | NarrativeQuestionStepDefinition<QuestionId>;

export type NarrativeBeatDefinition<QuestionId extends string = string> = {
  id: string;
  title: string;
  steps: NarrativeStepDefinition<QuestionId>[];
};

export type NarrativeChallengeDefinition<QuestionId extends string = string> =
  ChallengeDefinitionBase & {
    mode: "narrative";
    implementationStatus: ChallengeImplementationStatus;
    maxScore: number;
    prologue: NarrativeScene;
    beats: NarrativeBeatDefinition<QuestionId>[];
    questionPoints: ChallengeQuestionPoints<QuestionId>;
  };

/**
 * @deprecated Definición anidada del prototipo. Usa `ChallengeDefinition`,
 * `ChallengeVersion` y `ChallengeItem` de `@/types/domain`.
 */
export type ChallengeDefinition<QuestionId extends string = string> =
  | FlashChallengeDefinition<QuestionId>
  | AlphabetChallengeDefinition<QuestionId>
  | SurvivalChallengeDefinition<QuestionId>
  | NarrativeChallengeDefinition<QuestionId>
  | PyramidChallengeDefinition<QuestionId>;

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

/** @deprecated Publicación mock; usa `ScheduledChallenge` de `@/types/domain`. */
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

export type PyramidLevel = {
  id: string;
  label: string;
  question: Question;
  briefing: PyramidLevelBriefing;
};

export type PyramidChallenge = ChallengeBase & {
  mode: "pyramid";
  attemptVersion: number;
  availableFrom: string;
  availableUntil: string;
  levels: PyramidLevel[];
  questionPoints: Record<string, number>;
};

export type NarrativeSceneStep = NarrativeSceneStepDefinition;

export type NarrativeQuestionStep = {
  type: "question";
  question: Question;
  reactions?: NarrativeReactionMap;
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
};

/**
 * @deprecated Contrato gameplay completo del prototipo. En código nuevo combina
 * `ChallengeVersion`, `ChallengeItem` y `PublicQuestion`.
 */
export type Challenge =
  FlashChallenge | AlphabetChallenge | SurvivalChallenge | NarrativeChallenge | PyramidChallenge;
