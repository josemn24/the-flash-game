import type { ImageSurface, MultipleChoicePromptVisual, QuestionMedia } from "@/types/question";

export type FlashEditorialImageAssetReference = {
  readonly assetId: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly fit?: "cover" | "contain";
  readonly position?: string;
};

export type EditorialJsonPrimitive = boolean | number | string | null;
export type EditorialJsonValue =
  | EditorialJsonPrimitive
  | readonly EditorialJsonValue[]
  | { readonly [key: string]: EditorialJsonValue };
export type EditorialJsonObject = { readonly [key: string]: EditorialJsonValue };

export type FlashEditorialMultipleChoicePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly options: readonly string[];
  readonly media?: QuestionMedia | null;
  readonly promptVisual?: MultipleChoicePromptVisual | null;
};

export type FlashEditorialMiniWordlePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly hint?: string | null;
  readonly wordLength: 4 | 5;
  readonly maxAttempts: number;
};

export type FlashEditorialLogicCodeClue = {
  readonly code: string;
  readonly hint: string;
};

export type FlashEditorialLogicCodePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly clues: readonly FlashEditorialLogicCodeClue[];
  readonly codeLength: number;
};

export type FlashEditorialProgressiveCluesPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly clues: readonly string[];
  readonly cluePenalty: number;
};

export type FlashEditorialMatchingItem = {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly media?: QuestionMedia;
};

export type FlashEditorialMatchingPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly leftItems: readonly FlashEditorialMatchingItem[];
  readonly rightItems: readonly FlashEditorialMatchingItem[];
};

export type FlashEditorialProgressiveImagePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  /** Asset reference for new documents; ImageSurface remains readable for legacy v1 documents. */
  readonly surface: FlashEditorialImageAssetReference | ImageSurface;
  readonly revealDurationMs: number;
  readonly answerLabel?: string | null;
  readonly answerPlaceholder?: string | null;
};

export type FlashEditorialPublicPayload =
  | FlashEditorialMultipleChoicePublicPayload
  | FlashEditorialMiniWordlePublicPayload
  | FlashEditorialLogicCodePublicPayload
  | FlashEditorialProgressiveCluesPublicPayload
  | FlashEditorialMatchingPublicPayload
  | FlashEditorialProgressiveImagePublicPayload;

export type FlashEditorialMultipleChoiceSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialMiniWordleSolutionPayload = {
  readonly correctAnswer: string;
  /** Extra guesses for this question; they do not need to belong to the general dictionary. */
  readonly additionalGuesses: readonly string[];
  readonly dictionaryId: "es-general-4.v1" | "es-general-5.v1";
  readonly explanation?: string;
};

export type FlashEditorialLogicCodeSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialProgressiveCluesSolutionPayload = {
  readonly correctAnswer: string;
  readonly acceptedAnswers: readonly string[];
  readonly explanation?: string;
};

export type FlashEditorialMatchingSolutionPayload = {
  readonly matches: Readonly<Record<string, string>>;
  /** Type-level guard for callers that share the common solution accessor; rejected at runtime. */
  readonly correctAnswer?: never;
  readonly explanation?: string;
};

export type FlashEditorialProgressiveImageSolutionPayload = {
  readonly correctAnswer: string;
  readonly acceptedAnswers: readonly string[];
  readonly solutionAlt: string;
  readonly explanation?: string;
};

export type FlashEditorialSolutionPayload =
  | FlashEditorialMultipleChoiceSolutionPayload
  | FlashEditorialMiniWordleSolutionPayload
  | FlashEditorialLogicCodeSolutionPayload
  | FlashEditorialProgressiveCluesSolutionPayload
  | FlashEditorialMatchingSolutionPayload
  | FlashEditorialProgressiveImageSolutionPayload;

export type FlashEditorialMultipleChoiceQuestion = {
  readonly slug: string;
  readonly type: "multiple-choice";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialMultipleChoicePublicPayload;
  readonly solutionPayload: FlashEditorialMultipleChoiceSolutionPayload;
};

export type FlashEditorialMiniWordleQuestion = {
  readonly slug: string;
  readonly type: "mini-wordle";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialMiniWordlePublicPayload;
  readonly solutionPayload: FlashEditorialMiniWordleSolutionPayload;
};

export type FlashEditorialLogicCodeQuestion = {
  readonly slug: string;
  readonly type: "logic-code";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialLogicCodePublicPayload;
  readonly solutionPayload: FlashEditorialLogicCodeSolutionPayload;
};

export type FlashEditorialProgressiveCluesQuestion = {
  readonly slug: string;
  readonly type: "progressive-clues";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialProgressiveCluesPublicPayload;
  readonly solutionPayload: FlashEditorialProgressiveCluesSolutionPayload;
};

export type FlashEditorialMatchingQuestion = {
  readonly slug: string;
  readonly type: "matching";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialMatchingPublicPayload;
  readonly solutionPayload: FlashEditorialMatchingSolutionPayload;
};

export type FlashEditorialProgressiveImageQuestion = {
  readonly slug: string;
  readonly type: "progressive-image";
  readonly payloadSchemaVersion: 1 | 2;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialProgressiveImagePublicPayload;
  readonly solutionPayload: FlashEditorialProgressiveImageSolutionPayload;
};

export type FlashEditorialQuestion =
  | FlashEditorialMultipleChoiceQuestion
  | FlashEditorialMiniWordleQuestion
  | FlashEditorialLogicCodeQuestion
  | FlashEditorialProgressiveCluesQuestion
  | FlashEditorialMatchingQuestion
  | FlashEditorialProgressiveImageQuestion;

/**
 * Standalone question document. Points are deliberately absent: points belong
 * to the challenge item that uses a published question version.
 */
export type FlashEditorialQuestionDocument =
  | Omit<FlashEditorialMultipleChoiceQuestion, "points">
  | Omit<FlashEditorialMiniWordleQuestion, "points">
  | Omit<FlashEditorialLogicCodeQuestion, "points">
  | Omit<FlashEditorialProgressiveCluesQuestion, "points">
  | Omit<FlashEditorialMatchingQuestion, "points">
  | Omit<FlashEditorialProgressiveImageQuestion, "points">;

export type FlashEditorialQuestionReference = {
  readonly source: "library";
  readonly questionVersionId: string;
  readonly points: number;
  readonly modeConfig: EditorialJsonObject;
  readonly challengeItemId?: string;
};

export type FlashEditorialChallengeQuestion = FlashEditorialQuestion | FlashEditorialQuestionReference;

export type FlashEditorialDocument = {
  readonly challenge: {
    readonly slug: string;
    readonly title: string;
    readonly subtitle: string;
    readonly description: string;
    readonly mode: "flash";
    readonly configSchemaVersion: 1;
    readonly modeConfig: EditorialJsonObject;
  };
  readonly questions: readonly FlashEditorialChallengeQuestion[];
};

export type SuperadminQuestionLibraryStatus = EditorialContentStatus;

export type SuperadminQuestionLibraryEntry = {
  readonly questionDefinitionId: string;
  readonly questionVersionId: string;
  readonly versionNumber: number;
  readonly status: SuperadminQuestionLibraryStatus;
  readonly slug: string;
  readonly type:
    | "multiple-choice"
    | "mini-wordle"
    | "logic-code"
    | "progressive-clues"
    | "matching"
    | "progressive-image";
  readonly question: string;
  readonly category: string | null;
  readonly tags: EditorialJsonObject;
  readonly timeLimitMs: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly versionCount: number;
  readonly usageCount: number;
};

export type SuperadminQuestionLibraryContext = {
  readonly entries: readonly SuperadminQuestionLibraryEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly source: "supabase";
};

export type SuperadminQuestionVersionDetail = {
  readonly questionDefinitionId: string;
  readonly slug: string;
  readonly versions: readonly (SuperadminQuestionLibraryEntry & {
    readonly document: FlashEditorialQuestionDocument | null;
  })[];
  readonly source: "supabase";
};

export type EditorialContentStatus = "draft" | "published" | "archived";

export type SuperadminEditorialEntry = {
  readonly challengeDefinitionId: string;
  readonly challengeVersionId: string;
  readonly versionNumber: number;
  readonly status: EditorialContentStatus;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly mode: "flash";
  readonly questionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly document: FlashEditorialDocument | null;
};

export type SuperadminEditorialContext = {
  readonly entries: readonly SuperadminEditorialEntry[];
  readonly source: "supabase";
};

export type SuperadminEditorialCommandResult = Omit<SuperadminEditorialEntry, "document"> & {
  readonly document: FlashEditorialDocument | null;
  readonly source: "supabase";
};
