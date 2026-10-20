import type { LocalAlphabetDefinition } from "./local-alphabet";
import type {
  LocalFlashDefinition,
  LocalPyramidDefinition,
  LocalSurvivalDefinition,
} from "./local-pyramid";
import type { LocalTimeTrialDefinition } from "./local-time-trial";
import type { ServerFlashQuestion } from "./challenge";
type CompetitiveQuestionType = ServerFlashQuestion["type"];

export type RehearsalRef = {
  readonly id: string;
  readonly version: number;
  readonly contentHash: string;
};
export type RehearsalDefinition =
  | LocalFlashDefinition
  | LocalPyramidDefinition
  | LocalSurvivalDefinition
  | LocalAlphabetDefinition
  | LocalTimeTrialDefinition;
export type RehearsalMode = RehearsalDefinition["challenge"]["mode"];

/** Server-side source projection. It must never be serialized as a page model. */
export type RehearsalSource = {
  readonly mode: RehearsalMode;
  readonly globalTimeLimitMs: number | null;
  readonly modeConfig: Readonly<Record<string, unknown>>;
  readonly questions: readonly {
    readonly type: CompetitiveQuestionType;
    readonly payloadSchemaVersion: number;
    readonly timeLimitMs: number;
    readonly points: number;
    readonly modeConfig: Readonly<Record<string, unknown>>;
    readonly publicPayload: Readonly<Record<string, unknown>>;
    readonly solutionPayload?: Readonly<Record<string, unknown>>;
  }[];
};
export type RehearsalArtifact = {
  readonly ref: RehearsalRef;
  readonly title: string;
  readonly source: RehearsalSource;
  readonly definition: RehearsalDefinition;
};
/** Independent of the official introduction's canStart capability. */
export type RehearsalAvailability = { readonly canRehearse: true; readonly href: string };
