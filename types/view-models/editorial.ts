import type { MultipleChoicePromptVisual, QuestionMedia } from "@/types/question";

export type EditorialJsonPrimitive = boolean | number | string | null;
export type EditorialJsonValue =
  | EditorialJsonPrimitive
  | readonly EditorialJsonValue[]
  | { readonly [key: string]: EditorialJsonValue };
export type EditorialJsonObject = { readonly [key: string]: EditorialJsonValue };

export type FlashEditorialPublicPayload = {
  readonly category?: string;
  readonly tags?: EditorialJsonObject;
  readonly question: string;
  readonly options: readonly string[];
  readonly media?: QuestionMedia | null;
  readonly promptVisual?: MultipleChoicePromptVisual | null;
};

export type FlashEditorialSolutionPayload = {
  readonly correctAnswer: string;
  readonly explanation?: string;
};

export type FlashEditorialQuestion = {
  readonly slug: string;
  readonly type: "multiple-choice";
  readonly payloadSchemaVersion: 1;
  readonly timeLimitMs: number;
  readonly points: 50;
  readonly publicPayload: FlashEditorialPublicPayload;
  readonly solutionPayload: FlashEditorialSolutionPayload;
};

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
