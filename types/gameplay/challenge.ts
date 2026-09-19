import type {
  ImageSurface,
  MatchingItem,
  MatchingLeftItem,
  OddOneOutItem,
  AnagramTile,
  Question,
  QuestionMedia,
} from "@/types/question";
import type { MiniWordleLetterFeedback, MiniWordleWordLength } from "@/types/domain/mini-wordle";

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

/**
 * Competitive server projection. Its slots are deliberately metadata only: the
 * current question is released by the prepared interaction route, never by RSC.
 */
export type ServerFlashChallenge = ChallengeBase & {
  mode: "flash";
  slots: readonly {
    id: string;
    position: number;
    questionType:
      | "multiple-choice"
      | "mini-wordle"
      | "logic-code"
      | "progressive-clues"
      | "matching"
      | "progressive-image"
      | "queens"
      | "true-false"
      | "odd-one-out"
      | "ordering"
      | "anagram"
      | "classification";
    payloadSchemaVersion: number;
    timeLimitMs: number;
    points: number;
  }[];
  maxScore: number;
};

type ServerFlashQuestionBase = {
  readonly id: string;
  readonly category: string;
  readonly tags: Question["tags"];
  readonly question: string;
  readonly timeLimit: number;
  readonly points: number;
};

export type ServerMultipleChoiceQuestion = ServerFlashQuestionBase & {
  readonly type: "multiple-choice";
  readonly options: readonly string[];
  readonly media?: QuestionMedia;
};

export type ServerTrueFalseQuestion = ServerFlashQuestionBase & {
  readonly type: "true-false";
};

export type ServerOddOneOutQuestion = ServerFlashQuestionBase & {
  readonly type: "odd-one-out";
  readonly items: readonly OddOneOutItem[];
};

export type ServerOrderingQuestion = ServerFlashQuestionBase & {
  readonly type: "ordering";
  readonly items: readonly string[];
  readonly directionLabels: { readonly start: string; readonly end: string } | null;
};

export type ServerAnagramQuestion = ServerFlashQuestionBase & {
  readonly type: "anagram";
  readonly tiles: readonly AnagramTile[];
  readonly hint: string | null;
};

export type ServerClassificationQuestion = ServerFlashQuestionBase & {
  readonly type: "classification";
  readonly items: readonly { readonly label: string }[];
  readonly categories: readonly string[];
};

export type ServerMiniWordleProgress = {
  readonly kind: "mini-wordle";
  readonly guesses: readonly string[];
  readonly feedback: readonly MiniWordleLetterFeedback[][];
  readonly attemptsUsed: number;
  readonly maxAttempts: number;
};

export type ServerMiniWordleQuestion = ServerFlashQuestionBase & {
  readonly type: "mini-wordle";
  readonly hint: string | null;
  readonly wordLength: MiniWordleWordLength;
  readonly maxAttempts: number;
  readonly progress: ServerMiniWordleProgress;
};

export type ServerLogicCodeProgress = {
  readonly kind: "logic-code";
  readonly submittedCodes: readonly string[];
  readonly incorrectAttempts: number;
};

export type ServerLogicCodeQuestion = ServerFlashQuestionBase & {
  readonly type: "logic-code";
  readonly clues: readonly { readonly code: string; readonly hint: string }[];
  readonly codeLength: number;
  readonly progress: ServerLogicCodeProgress;
};

export type ServerMatchingPair = {
  readonly leftId: string;
  readonly rightId: string;
};

export type ServerMatchingProgress = {
  readonly kind: "matching";
  readonly matchedPairs: readonly ServerMatchingPair[];
  readonly matchedCount: number;
  readonly totalPairs: number;
  readonly incorrectAttempts: number;
  readonly penaltyPoints: number;
};

export type ServerMatchingQuestion = ServerFlashQuestionBase & {
  readonly type: "matching";
  readonly leftItems: readonly Omit<MatchingLeftItem, "correctMatchId">[];
  readonly rightItems: readonly MatchingItem[];
  readonly progress: ServerMatchingProgress;
};

export type ServerProgressiveCluesProgress = {
  readonly kind: "progressive-clues";
  readonly clues: readonly string[];
  readonly revealedClues: number;
  readonly totalClues: number;
  readonly availablePoints: number;
  readonly cluePenalty: number;
};

export type ServerProgressiveCluesQuestion = ServerFlashQuestionBase & {
  readonly type: "progressive-clues";
  readonly clues: readonly string[];
  readonly totalClues: number;
  readonly cluePenalty: number;
  readonly progress: ServerProgressiveCluesProgress;
};

export type ServerProgressiveImageQuestion = ServerFlashQuestionBase & {
  readonly type: "progressive-image";
  readonly surface: ImageSurface;
  readonly revealDuration: number;
  readonly answerLabel: string | null;
  readonly answerPlaceholder: string | null;
};

export type ServerQueensProgress = {
  readonly kind: "queens";
  readonly queens: readonly number[];
  readonly placedQueens: number;
  readonly completedRows: number;
  readonly completedColumns: number;
  readonly completedRegions: number;
  readonly conflictingQueens: number;
  readonly solved: boolean;
};

export type ServerQueensQuestion = ServerFlashQuestionBase & {
  readonly type: "queens";
  readonly grid: { readonly rows: 5; readonly columns: 5 };
  readonly regions: readonly number[];
  readonly prefilledQueens: readonly number[];
  readonly progress: ServerQueensProgress;
};

export type ServerFlashQuestion =
  | ServerMultipleChoiceQuestion
  | ServerMiniWordleQuestion
  | ServerLogicCodeQuestion
  | ServerProgressiveCluesQuestion
  | ServerMatchingQuestion
  | ServerProgressiveImageQuestion
  | ServerQueensQuestion
  | ServerTrueFalseQuestion
  | ServerOddOneOutQuestion
  | ServerOrderingQuestion
  | ServerAnagramQuestion
  | ServerClassificationQuestion;

/**
 * Terminal-only projection used to rebuild the owner's answer review after a
 * page reload. It must never be returned while an attempt is in progress.
 */
export type ServerFlashTerminalReview = {
  readonly challengeItemId: string;
  readonly publicPayload: unknown;
  readonly solutionPayload: unknown;
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
