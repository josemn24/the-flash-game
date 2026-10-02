import type { ScoringPolicyId } from "@/lib/scoringCore/types";
import type { QuestionType } from "@/types/contracts/questions";
import type { GameMode } from "@/types/domain/content";

/**
 * Transport selected by the competitive command boundary. This is a key, not
 * an implementation: the actual HTTP/application adapters stay in their own
 * layer.
 */
export type CompetitiveTransport = "generic" | "specialized";

export type CompetitiveAdapterKey =
  | "generic"
  | "alphabet-pass"
  | "mini-wordle"
  | "logic-code"
  | "progressive-clues"
  | "queens"
  | "word-search"
  | "word-hashtag";

export type CompetitiveFormatCapability = {
  readonly payloadSchemaVersions: readonly number[];
  readonly transport: CompetitiveTransport;
  readonly adapterKey: CompetitiveAdapterKey;
};

export type FormatCapabilities = {
  readonly id: QuestionType;
  readonly practice: {
    readonly supported: boolean;
    readonly rendererKey: string;
    readonly catalogVisible: boolean;
    readonly exampleRequired: boolean;
  };
  readonly scoringPolicyId: ScoringPolicyId;
  readonly validation: {
    readonly publicValidatorKey: string;
    readonly solutionValidatorKey: string;
    readonly payloadSchemaVersions: readonly number[];
    /** The PostgreSQL validation branch used by competitive publication. */
    readonly sqlValidation: "base" | "competitive-extension";
  };
  readonly competitive: Partial<Record<GameMode, CompetitiveFormatCapability>>;
};

export const practice = {
  supported: true,
  catalogVisible: true,
  exampleRequired: true,
} as const;

export const generic = {
  payloadSchemaVersions: [1],
  transport: "generic",
  adapterKey: "generic",
} as const satisfies CompetitiveFormatCapability;

export const specialized = <T extends Exclude<CompetitiveAdapterKey, "generic" | "alphabet-pass">>(
  adapterKey: T,
  payloadSchemaVersions: readonly number[] = [1],
) =>
  ({
    payloadSchemaVersions,
    transport: "specialized",
    adapterKey,
  }) as const satisfies CompetitiveFormatCapability;

export const alphabetPass = {
  payloadSchemaVersions: [1],
  transport: "specialized",
  adapterKey: "alphabet-pass",
} as const satisfies CompetitiveFormatCapability;

export const competitiveExtension = {
  sqlValidation: "competitive-extension",
} as const;

export const baseValidation = {
  sqlValidation: "base",
} as const;

/**
 * Canonical format metadata. Keep this object pure: it must not import React,
 * server-only modules, validators or scoring implementations.
 */
