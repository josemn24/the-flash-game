import type { MultipleChoicePromptVisual, QuestionMedia } from "@/types/question";

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

export type FlashEditorialPublicPayload =
  | FlashEditorialMultipleChoicePublicPayload
  | FlashEditorialMiniWordlePublicPayload
  | FlashEditorialLogicCodePublicPayload;

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

export type FlashEditorialSolutionPayload =
  | FlashEditorialMultipleChoiceSolutionPayload
  | FlashEditorialMiniWordleSolutionPayload
  | FlashEditorialLogicCodeSolutionPayload;

export type FlashEditorialMultipleChoiceQuestion = {
  readonly slug: string;
  readonly type: "multiple-choice";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: 50;
  readonly publicPayload: FlashEditorialMultipleChoicePublicPayload;
  readonly solutionPayload: FlashEditorialMultipleChoiceSolutionPayload;
};

export type FlashEditorialMiniWordleQuestion = {
  readonly slug: string;
  readonly type: "mini-wordle";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: 50;
  readonly publicPayload: FlashEditorialMiniWordlePublicPayload;
  readonly solutionPayload: FlashEditorialMiniWordleSolutionPayload;
};

export type FlashEditorialLogicCodeQuestion = {
  readonly slug: string;
  readonly type: "logic-code";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: 50;
  readonly publicPayload: FlashEditorialLogicCodePublicPayload;
  readonly solutionPayload: FlashEditorialLogicCodeSolutionPayload;
};

export type FlashEditorialQuestion =
  | FlashEditorialMultipleChoiceQuestion
  | FlashEditorialMiniWordleQuestion
  | FlashEditorialLogicCodeQuestion;

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
  readonly questions: readonly [FlashEditorialQuestion, FlashEditorialQuestion];
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
