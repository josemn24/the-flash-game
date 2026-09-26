import type {
  EscapeBlock,
  EscapeMove,
  ImageSurface,
  MultipleChoicePromptVisual,
  QuestionMedia,
} from "@/types/question";

export type FlashEditorialImageAssetReference = {
  readonly assetId: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly fit?: "cover" | "contain";
  readonly position?: string;
};

export type FlashEditorialMultipleChoiceImageAssetReference = FlashEditorialImageAssetReference & {
  readonly type: "image";
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
  readonly media?: QuestionMedia | FlashEditorialMultipleChoiceImageAssetReference | null;
  readonly promptVisual?: MultipleChoicePromptVisual | null;
};

export type FlashEditorialEstimationPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly initialValue: number;
  readonly unit: string;
  readonly media: FlashEditorialMultipleChoiceImageAssetReference | null;
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

export type FlashEditorialLogicMatrixPiece = {
  readonly id: string;
  readonly symbol: string;
  readonly label: string;
};

export type FlashEditorialLogicMatrixPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly pieces: readonly FlashEditorialLogicMatrixPiece[];
  readonly cells: readonly (string | null)[];
  readonly optionIds: readonly string[];
  readonly showPieceLabels?: boolean | null;
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

export type FlashEditorialTrueFalsePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
};

export type FlashEditorialOddOneOutItem = {
  readonly id: string;
  readonly label: string;
  readonly media?: QuestionMedia;
};

export type FlashEditorialOddOneOutPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly items: readonly FlashEditorialOddOneOutItem[];
};

export type FlashEditorialOrderingPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly items: readonly string[];
  readonly directionLabels?: { readonly start: string; readonly end: string } | null;
};

export type FlashEditorialAnagramTile = {
  readonly id: string;
  readonly value: string;
};

export type FlashEditorialAnagramPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly tiles: readonly FlashEditorialAnagramTile[];
  readonly hint?: string | null;
};

export type FlashEditorialClassificationItem = {
  readonly label: string;
};

export type FlashEditorialClassificationPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly items: readonly FlashEditorialClassificationItem[];
  readonly categories: readonly string[];
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

export type FlashEditorialShortTextPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly answerPlaceholder?: string | null;
};

export type FlashEditorialWordSearchCell = {
  readonly startCell: number;
  readonly endCell: number;
};

export type FlashEditorialWordSearchTarget = {
  readonly id: string;
  readonly word: string;
};

export type FlashEditorialWordSearchPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly grid: { readonly rows: number; readonly columns: number };
  readonly letters: readonly string[];
  readonly targets: readonly FlashEditorialWordSearchTarget[];
};

export type FlashEditorialZipCheckpoint = {
  readonly value: number;
  readonly cell: number;
  readonly label?: string;
};

export type FlashEditorialZipPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly grid: { readonly rows: 5; readonly columns: 5 };
  readonly checkpoints: readonly FlashEditorialZipCheckpoint[];
  readonly instruction?: string;
  readonly mapNote?: string;
  readonly boardLabel?: string;
};

export type FlashEditorialEscapePublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly grid: {
    readonly rows: 6;
    readonly columns: 6;
    readonly exit: { readonly side: "right"; readonly row: number };
  };
  readonly initialBlocks: readonly EscapeBlock[];
  readonly instruction?: string;
  readonly hideInstruction?: boolean;
  readonly objectiveLabel?: string;
  readonly hideObjectiveLabel?: boolean;
  readonly completionMessage?: string;
  readonly boardLabel?: string;
};

export type FlashEditorialPublicPayload =
  | FlashEditorialMultipleChoicePublicPayload
  | FlashEditorialEstimationPublicPayload
  | FlashEditorialMiniWordlePublicPayload
  | FlashEditorialLogicCodePublicPayload
  | FlashEditorialLogicMatrixPublicPayload
  | FlashEditorialProgressiveCluesPublicPayload
  | FlashEditorialMatchingPublicPayload
  | FlashEditorialTrueFalsePublicPayload
  | FlashEditorialOddOneOutPublicPayload
  | FlashEditorialOrderingPublicPayload
  | FlashEditorialAnagramPublicPayload
  | FlashEditorialClassificationPublicPayload
  | FlashEditorialProgressiveImagePublicPayload
  | FlashEditorialShortTextPublicPayload
  | FlashEditorialWordSearchPublicPayload
  | FlashEditorialZipPublicPayload
  | FlashEditorialEscapePublicPayload;

export type FlashEditorialMultipleChoiceSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialEstimationSolutionPayload = {
  readonly correctAnswer: number;
  readonly tolerance: number;
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

export type FlashEditorialLogicMatrixSolutionPayload = {
  readonly correctOptionId: string;
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

export type FlashEditorialTrueFalseSolutionPayload = {
  readonly correctAnswer: boolean;
  readonly explanation?: string;
};

export type FlashEditorialOddOneOutSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialOrderingSolutionPayload = {
  readonly correctOrder: readonly string[];
  readonly explanation?: string;
};

export type FlashEditorialAnagramSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialClassificationSolutionPayload = {
  readonly categoriesByItem: Readonly<Record<string, string>>;
  readonly explanation?: string;
};

export type FlashEditorialProgressiveImageSolutionPayload = {
  readonly correctAnswer: string;
  readonly acceptedAnswers: readonly string[];
  readonly solutionAlt: string;
  readonly explanation?: string;
};

export type FlashEditorialShortTextSolutionPayload = {
  readonly correctAnswer: string;
  readonly acceptedAnswers: readonly string[];
  readonly explanation?: string;
};

export type FlashEditorialWordSearchSolutionPayload = {
  readonly positionsByTargetId: Readonly<Record<string, FlashEditorialWordSearchCell>>;
  readonly explanation?: string;
};

export type FlashEditorialZipSolutionPayload = {
  readonly solution: readonly number[];
  readonly explanation?: string;
};

export type FlashEditorialEscapeSolutionPayload = {
  readonly referenceSolution: readonly EscapeMove[];
  readonly optimalMoves: number;
  readonly explanation?: string;
};

export type FlashEditorialSolutionPayload =
  | FlashEditorialMultipleChoiceSolutionPayload
  | FlashEditorialEstimationSolutionPayload
  | FlashEditorialMiniWordleSolutionPayload
  | FlashEditorialLogicCodeSolutionPayload
  | FlashEditorialLogicMatrixSolutionPayload
  | FlashEditorialProgressiveCluesSolutionPayload
  | FlashEditorialMatchingSolutionPayload
  | FlashEditorialTrueFalseSolutionPayload
  | FlashEditorialOddOneOutSolutionPayload
  | FlashEditorialOrderingSolutionPayload
  | FlashEditorialAnagramSolutionPayload
  | FlashEditorialClassificationSolutionPayload
  | FlashEditorialProgressiveImageSolutionPayload
  | FlashEditorialShortTextSolutionPayload
  | FlashEditorialWordSearchSolutionPayload
  | FlashEditorialZipSolutionPayload
  | FlashEditorialEscapeSolutionPayload;

export type FlashEditorialMultipleChoiceQuestion = {
  readonly slug: string;
  readonly type: "multiple-choice";
  readonly payloadSchemaVersion: 1 | 2;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialMultipleChoicePublicPayload;
  readonly solutionPayload: FlashEditorialMultipleChoiceSolutionPayload;
};

export type FlashEditorialEstimationQuestion = {
  readonly slug: string;
  readonly type: "estimation";
  readonly payloadSchemaVersion: 2;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialEstimationPublicPayload;
  readonly solutionPayload: FlashEditorialEstimationSolutionPayload;
};

export type FlashEditorialHeatMapPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly surface: FlashEditorialImageAssetReference;
  readonly targetLabel: string;
};

export type FlashEditorialHeatMapSolutionPayload = {
  readonly target: { readonly x: number; readonly y: number };
  readonly fullCreditRadius: number;
  readonly toleranceRadius: number;
  readonly explanation?: string;
};

export type FlashEditorialHeatMapQuestion = {
  readonly slug: string;
  readonly type: "heat-map";
  readonly payloadSchemaVersion: 2;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialHeatMapPublicPayload;
  readonly solutionPayload: FlashEditorialHeatMapSolutionPayload;
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

export type FlashEditorialLogicMatrixQuestion = {
  readonly slug: string;
  readonly type: "logic-matrix";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialLogicMatrixPublicPayload;
  readonly solutionPayload: FlashEditorialLogicMatrixSolutionPayload;
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

export type FlashEditorialTrueFalseQuestion = {
  readonly slug: string;
  readonly type: "true-false";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialTrueFalsePublicPayload;
  readonly solutionPayload: FlashEditorialTrueFalseSolutionPayload;
};

export type FlashEditorialOddOneOutQuestion = {
  readonly slug: string;
  readonly type: "odd-one-out";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialOddOneOutPublicPayload;
  readonly solutionPayload: FlashEditorialOddOneOutSolutionPayload;
};

export type FlashEditorialOrderingQuestion = {
  readonly slug: string;
  readonly type: "ordering";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialOrderingPublicPayload;
  readonly solutionPayload: FlashEditorialOrderingSolutionPayload;
};

export type FlashEditorialAnagramQuestion = {
  readonly slug: string;
  readonly type: "anagram";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialAnagramPublicPayload;
  readonly solutionPayload: FlashEditorialAnagramSolutionPayload;
};

export type FlashEditorialClassificationQuestion = {
  readonly slug: string;
  readonly type: "classification";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialClassificationPublicPayload;
  readonly solutionPayload: FlashEditorialClassificationSolutionPayload;
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

export type FlashEditorialWordSearchQuestion = {
  readonly slug: string;
  readonly type: "word-search";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialWordSearchPublicPayload;
  readonly solutionPayload: FlashEditorialWordSearchSolutionPayload;
};

export type FlashEditorialWordHashtagPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly grid: { readonly rows: 5; readonly columns: 5 };
  readonly initialLetters: readonly (string | null)[];
  readonly maxMoves: number;
};

export type FlashEditorialWordHashtagSolutionPayload = {
  readonly words: import("@/types/question").WordHashtagWords;
  readonly explanation?: string;
};

export type FlashEditorialWordHashtagQuestion = {
  readonly slug: string;
  readonly type: "word-hashtag";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialWordHashtagPublicPayload;
  readonly solutionPayload: FlashEditorialWordHashtagSolutionPayload;
};

export type FlashEditorialZipQuestion = {
  readonly slug: string;
  readonly type: "zip";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialZipPublicPayload;
  readonly solutionPayload: FlashEditorialZipSolutionPayload;
};

export type FlashEditorialEscapeQuestion = {
  readonly slug: string;
  readonly type: "escape";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly publicPayload: FlashEditorialEscapePublicPayload;
  readonly solutionPayload: FlashEditorialEscapeSolutionPayload;
};

export type FlashEditorialQuestion =
  | FlashEditorialMultipleChoiceQuestion
  | FlashEditorialEstimationQuestion
  | FlashEditorialHeatMapQuestion
  | FlashEditorialMiniWordleQuestion
  | FlashEditorialLogicCodeQuestion
  | FlashEditorialLogicMatrixQuestion
  | FlashEditorialProgressiveCluesQuestion
  | FlashEditorialMatchingQuestion
  | FlashEditorialTrueFalseQuestion
  | FlashEditorialOddOneOutQuestion
  | FlashEditorialOrderingQuestion
  | FlashEditorialAnagramQuestion
  | FlashEditorialClassificationQuestion
  | FlashEditorialProgressiveImageQuestion
  | FlashEditorialWordSearchQuestion
  | FlashEditorialWordHashtagQuestion
  | FlashEditorialZipQuestion
  | FlashEditorialEscapeQuestion
  | {
      readonly slug: string;
      readonly type: "short-text";
      readonly payloadSchemaVersion: 1;
      readonly timeLimitMs: number;
      readonly points: number;
      readonly publicPayload: FlashEditorialShortTextPublicPayload;
      readonly solutionPayload: FlashEditorialShortTextSolutionPayload;
    };

/**
 * Standalone question document. Points are deliberately absent: points belong
 * to the challenge item that uses a published question version.
 */
export type FlashEditorialQuestionDocument =
  | Omit<FlashEditorialMultipleChoiceQuestion, "points">
  | Omit<FlashEditorialEstimationQuestion, "points">
  | Omit<FlashEditorialHeatMapQuestion, "points">
  | Omit<FlashEditorialMiniWordleQuestion, "points">
  | Omit<FlashEditorialLogicCodeQuestion, "points">
  | Omit<FlashEditorialLogicMatrixQuestion, "points">
  | Omit<FlashEditorialProgressiveCluesQuestion, "points">
  | Omit<FlashEditorialMatchingQuestion, "points">
  | Omit<FlashEditorialTrueFalseQuestion, "points">
  | Omit<FlashEditorialOddOneOutQuestion, "points">
  | Omit<FlashEditorialOrderingQuestion, "points">
  | Omit<FlashEditorialAnagramQuestion, "points">
  | Omit<FlashEditorialClassificationQuestion, "points">
  | Omit<FlashEditorialProgressiveImageQuestion, "points">
  | Omit<FlashEditorialWordSearchQuestion, "points">
  | Omit<FlashEditorialWordHashtagQuestion, "points">
  | Omit<FlashEditorialZipQuestion, "points">
  | Omit<FlashEditorialEscapeQuestion, "points">
  | Omit<Extract<FlashEditorialQuestion, { readonly type: "short-text" }>, "points">;

export type FlashEditorialQuestionReference = {
  readonly source: "library";
  readonly questionVersionId: string;
  readonly points: number;
  readonly modeConfig: EditorialJsonObject;
  readonly challengeItemId?: string;
};

export type FlashEditorialChallengeQuestion =
  | (FlashEditorialQuestion & { readonly modeConfig?: EditorialJsonObject })
  | FlashEditorialQuestionReference;

export type FlashEditorialDocument = {
  readonly challenge: {
    readonly slug: string;
    readonly title: string;
    readonly subtitle: string;
    readonly description: string;
    readonly mode: "flash" | "alphabet" | "survival" | "pyramid";
    readonly configSchemaVersion: 1;
    readonly modeConfig: EditorialJsonObject;
    readonly globalTimeLimitMs?: number;
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
    | "estimation"
    | "heat-map"
    | "mini-wordle"
    | "logic-code"
    | "logic-matrix"
    | "progressive-clues"
    | "matching"
    | "true-false"
    | "odd-one-out"
    | "ordering"
    | "anagram"
    | "classification"
    | "progressive-image"
    | "short-text"
    | "word-search"
    | "word-hashtag"
    | "zip"
    | "escape";
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
  readonly mode: "flash" | "survival" | "pyramid";
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

export type SuperadminChallengeStatusCounts = Readonly<Record<EditorialContentStatus, number>>;

export type SuperadminChallengeSummary = {
  readonly challengeDefinitionId: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly mode: "flash" | "survival" | "pyramid";
  readonly questionCount: number;
  readonly versionCount: number;
  readonly status: EditorialContentStatus;
  readonly statusCounts: SuperadminChallengeStatusCounts;
  readonly updatedAt: string;
  readonly latestVersion: {
    readonly challengeVersionId: string;
    readonly versionNumber: number;
    readonly status: EditorialContentStatus;
    readonly questionCount: number;
    readonly updatedAt: string;
    readonly publishedAt: string | null;
  };
};

export type SuperadminChallengeCatalogContext = {
  readonly entries: readonly SuperadminChallengeSummary[];
  readonly source: "supabase";
};

export type SuperadminChallengeDetailContext = {
  readonly challengeDefinitionId: string;
  readonly entries: readonly SuperadminEditorialEntry[];
  readonly source: "supabase";
};

export type SuperadminEditorialCommandResult = Omit<SuperadminEditorialEntry, "document"> & {
  readonly document: FlashEditorialDocument | null;
  readonly source: "supabase";
};
