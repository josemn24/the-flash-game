export type {
  EditorialJsonObject,
  EditorialJsonPrimitive,
  EditorialJsonValue,
  FlashEditorialAnagramPublicPayload,
  FlashEditorialAnagramQuestion,
  FlashEditorialAnagramSolutionPayload,
  FlashEditorialAnagramTile,
  FlashEditorialClassificationItem,
  FlashEditorialClassificationPublicPayload,
  FlashEditorialClassificationQuestion,
  FlashEditorialClassificationSolutionPayload,
  FlashEditorialEscapePublicPayload,
  FlashEditorialEscapeQuestion,
  FlashEditorialEscapeSolutionPayload,
  FlashEditorialEstimationPublicPayload,
  FlashEditorialEstimationQuestion,
  FlashEditorialEstimationSolutionPayload,
  FlashEditorialHeatMapPublicPayload,
  FlashEditorialHeatMapQuestion,
  FlashEditorialHeatMapSolutionPayload,
  FlashEditorialImageAssetReference,
  FlashEditorialLogicCodeClue,
  FlashEditorialLogicCodePublicPayload,
  FlashEditorialLogicCodeQuestion,
  FlashEditorialLogicCodeSolutionPayload,
  FlashEditorialLogicMatrixPiece,
  FlashEditorialLogicMatrixPublicPayload,
  FlashEditorialLogicMatrixQuestion,
  FlashEditorialLogicMatrixSolutionPayload,
  FlashEditorialMatchingItem,
  FlashEditorialMatchingPublicPayload,
  FlashEditorialMatchingQuestion,
  FlashEditorialMatchingSolutionPayload,
  FlashEditorialMiniWordlePublicPayload,
  FlashEditorialMiniWordleQuestion,
  FlashEditorialMiniWordleSolutionPayload,
  FlashEditorialMultipleChoiceImageAssetReference,
  FlashEditorialMultipleChoicePublicPayload,
  FlashEditorialMultipleChoiceQuestion,
  FlashEditorialMultipleChoiceSolutionPayload,
  FlashEditorialOddOneOutItem,
  FlashEditorialOddOneOutPublicPayload,
  FlashEditorialOddOneOutQuestion,
  FlashEditorialOddOneOutSolutionPayload,
  FlashEditorialOrderingPublicPayload,
  FlashEditorialOrderingQuestion,
  FlashEditorialOrderingSolutionPayload,
  FlashEditorialProgressiveCluesPublicPayload,
  FlashEditorialProgressiveCluesQuestion,
  FlashEditorialProgressiveCluesSolutionPayload,
  FlashEditorialProgressiveImagePublicPayload,
  FlashEditorialProgressiveImageQuestion,
  FlashEditorialProgressiveImageSolutionPayload,
  FlashEditorialPublicPayload,
  FlashEditorialQuestion,
  FlashEditorialQuestionDocument,
  FlashEditorialShortTextPublicPayload,
  FlashEditorialShortTextSolutionPayload,
  FlashEditorialSolutionPayload,
  FlashEditorialTrueFalsePublicPayload,
  FlashEditorialTrueFalseQuestion,
  FlashEditorialTrueFalseSolutionPayload,
  FlashEditorialWordHashtagPublicPayload,
  FlashEditorialWordHashtagQuestion,
  FlashEditorialWordHashtagSolutionPayload,
  FlashEditorialWordSearchCell,
  FlashEditorialWordSearchPublicPayload,
  FlashEditorialWordSearchQuestion,
  FlashEditorialWordSearchSolutionPayload,
  FlashEditorialWordSearchTarget,
  FlashEditorialZipCheckpoint,
  FlashEditorialZipPublicPayload,
  FlashEditorialZipQuestion,
  FlashEditorialZipSolutionPayload,
} from "@/types/contracts/stored-questions";
import type {
  EditorialJsonObject,
  FlashEditorialQuestion,
  FlashEditorialQuestionDocument,
} from "@/types/contracts/stored-questions";
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
    readonly mode: "flash" | "alphabet" | "survival" | "narrative" | "pyramid";
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
  readonly mode: "flash" | "survival" | "narrative" | "pyramid";
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
  readonly mode: "flash" | "survival" | "narrative" | "pyramid";
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

export type SuperadminChallengeVersionSnapshotItem = {
  readonly challengeItemId: string;
  readonly position: number;
  readonly questionVersionId: string;
  readonly questionDefinitionId: string;
  readonly questionVersionNumber: number;
  readonly questionStatus: EditorialContentStatus;
  readonly slug: string;
  readonly type: string;
  readonly payloadSchemaVersion: number;
  readonly timeLimitMs: number;
  readonly points: number;
  readonly modeConfig: EditorialJsonObject;
  readonly publicPayload: EditorialJsonObject;
};

export type SuperadminChallengeVersionSnapshot = {
  readonly challengeVersionId: string;
  readonly versionNumber: number;
  readonly status: EditorialContentStatus;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly mode: "flash" | "survival" | "narrative" | "pyramid";
  readonly configSchemaVersion: number;
  readonly modeConfig: EditorialJsonObject;
  readonly globalTimeLimitMs: number | null;
  readonly items: readonly SuperadminChallengeVersionSnapshotItem[];
};

export type SuperadminChallengeVersionComparison = {
  readonly challengeDefinitionId: string;
  readonly from: SuperadminChallengeVersionSnapshot;
  readonly to: SuperadminChallengeVersionSnapshot;
  readonly source: "supabase";
};

export type SuperadminEditorialCommandResult = Omit<SuperadminEditorialEntry, "document"> & {
  readonly document: FlashEditorialDocument | null;
  readonly source: "supabase";
};
