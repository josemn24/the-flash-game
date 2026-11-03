import type { LocalAlphabetDefinition } from "./local-alphabet";
import type {
  LocalFlashDefinition,
  LocalPyramidDefinition,
  LocalSurvivalDefinition,
} from "./local-pyramid";
import type { LocalTimeTrialDefinition } from "./local-time-trial";
import type { ServerFlashQuestion } from "./challenge";
type CompetitiveQuestionType = ServerFlashQuestion["type"];
import type { QuestionDifficulty } from "@/types/domain/content";

export type RehearsalDefinition =
  | LocalFlashDefinition
  | LocalPyramidDefinition
  | LocalSurvivalDefinition
  | LocalAlphabetDefinition
  | LocalTimeTrialDefinition;
export type RehearsalMode = RehearsalDefinition["challenge"]["mode"];
export type RehearsalQuestionRef = {
  readonly id: string;
  readonly version: number;
  readonly contentHash: string;
};
export type RehearsalBankQuestion = {
  readonly id: string;
  readonly version: number;
  readonly type: CompetitiveQuestionType;
  readonly generationStatus?: "active" | "retired";
  readonly payloadSchemaVersion: number;
  readonly modes: readonly RehearsalMode[];
  readonly difficulty: QuestionDifficulty;
  readonly referenceTimeLimitMs: number;
  readonly familyId?: string;
  readonly alphabetLetter?: string;
  readonly publicPayload: Readonly<Record<string, unknown>>;
  readonly solutionPayload: Readonly<Record<string, unknown>>;
};
/** Server-only structural source. Official text never belongs in a generated definition. */
export type RehearsalTemplate = {
  readonly challengeVersionId: string;
  readonly title: string;
  readonly mode: RehearsalMode;
  readonly globalTimeLimitMs: number | null;
  readonly modeConfig: Readonly<Record<string, unknown>>;
  readonly questions: readonly {
    readonly type: CompetitiveQuestionType;
    readonly payloadSchemaVersion: number;
    readonly difficulty: QuestionDifficulty;
    readonly timeLimitMs: number;
    readonly points: number;
    readonly modeConfig: Readonly<Record<string, unknown>>;
    readonly mechanics: Readonly<Record<string, unknown>>;
  }[];
};
export type RehearsalCoverage = {
  readonly ready: boolean;
  readonly exactDifficultyReady: boolean;
  readonly warnings: readonly string[];
  readonly slots: readonly {
    readonly position: number;
    readonly type: CompetitiveQuestionType;
    readonly difficulty: QuestionDifficulty;
    readonly candidateCount: number;
    readonly independentCandidateCount: number;
    readonly alphabetLetter?: string;
    readonly difficulties: Readonly<Record<QuestionDifficulty, number>>;
    readonly excluded: Readonly<Record<string, number>>;
    readonly warnings: readonly string[];
  }[];
};
export type RehearsalRecipe = {
  readonly sessionId: string;
  readonly seed: string;
  readonly generatorVersion: 1;
  readonly bankRevision: string;
  readonly templateHash: string;
  readonly challengeVersionId: string;
  readonly questions: readonly RehearsalQuestionRef[];
};
export type GeneratedRehearsal = {
  readonly definition: RehearsalDefinition;
  readonly recipe: RehearsalRecipe;
  readonly difficultyFallbacks: readonly {
    readonly position: number;
    readonly requested: QuestionDifficulty;
    readonly selected: QuestionDifficulty;
  }[];
};
export type RehearsalPolicy = {
  readonly label?: string;
  readonly publicationId: string;
  readonly enabled: boolean;
  readonly updatedAt: string | null;
};
export type RehearsalAvailability = { readonly canRehearse: true; readonly href: string };
