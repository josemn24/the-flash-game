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

const practice = {
  supported: true,
  catalogVisible: true,
  exampleRequired: true,
} as const;

const generic = {
  payloadSchemaVersions: [1],
  transport: "generic",
  adapterKey: "generic",
} as const satisfies CompetitiveFormatCapability;

const specialized = <T extends Exclude<CompetitiveAdapterKey, "generic" | "alphabet-pass">>(
  adapterKey: T,
  payloadSchemaVersions: readonly number[] = [1],
) =>
  ({
    payloadSchemaVersions,
    transport: "specialized",
    adapterKey,
  }) as const satisfies CompetitiveFormatCapability;

const alphabetPass = {
  payloadSchemaVersions: [1],
  transport: "specialized",
  adapterKey: "alphabet-pass",
} as const satisfies CompetitiveFormatCapability;

const competitiveExtension = {
  sqlValidation: "competitive-extension",
} as const;

const baseValidation = {
  sqlValidation: "base",
} as const;

/**
 * Canonical format metadata. Keep this object pure: it must not import React,
 * server-only modules, validators or scoring implementations.
 */
export const QUESTION_FORMAT_CAPABILITIES = {
  "multiple-choice": {
    id: "multiple-choice",
    practice: { ...practice, rendererKey: "multiple-choice" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "multiple-choice",
      solutionValidatorKey: "multiple-choice",
      payloadSchemaVersions: [1, 2],
      ...baseValidation,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "odd-one-out": {
    id: "odd-one-out",
    practice: { ...practice, rendererKey: "odd-one-out" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "odd-one-out",
      solutionValidatorKey: "odd-one-out",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  matching: {
    id: "matching",
    practice: { ...practice, rendererKey: "matching" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "matching",
      solutionValidatorKey: "matching",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "connect-pairs": {
    id: "connect-pairs",
    practice: { ...practice, rendererKey: "connect-pairs" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "connect-pairs",
      solutionValidatorKey: "connect-pairs",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "true-false": {
    id: "true-false",
    practice: { ...practice, rendererKey: "true-false" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "true-false",
      solutionValidatorKey: "true-false",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "short-text": {
    id: "short-text",
    practice: { ...practice, rendererKey: "short-text" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "short-text",
      solutionValidatorKey: "short-text",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: { flash: generic, pyramid: generic, alphabet: alphabetPass },
  },
  "progressive-clues": {
    id: "progressive-clues",
    practice: { ...practice, rendererKey: "progressive-clues" },
    scoringPolicyId: "clue-speed",
    validation: {
      publicValidatorKey: "progressive-clues",
      solutionValidatorKey: "progressive-clues",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {
      flash: specialized("progressive-clues"),
      survival: specialized("progressive-clues"),
      pyramid: specialized("progressive-clues"),
      narrative: specialized("progressive-clues"),
    },
  },
  "progressive-image": {
    id: "progressive-image",
    practice: { ...practice, rendererKey: "progressive-image" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "progressive-image",
      solutionValidatorKey: "progressive-image",
      payloadSchemaVersions: [1, 2],
      ...baseValidation,
    },
    competitive: {
      flash: { ...generic, payloadSchemaVersions: [1, 2] },
      survival: { ...generic, payloadSchemaVersions: [1, 2] },
      pyramid: { ...generic, payloadSchemaVersions: [1, 2] },
      narrative: { ...generic, payloadSchemaVersions: [1, 2] },
    },
  },
  "heat-map": {
    id: "heat-map",
    practice: { ...practice, rendererKey: "heat-map" },
    scoringPolicyId: "spatial-proximity",
    validation: {
      publicValidatorKey: "heat-map",
      solutionValidatorKey: "heat-map",
      payloadSchemaVersions: [2],
      ...baseValidation,
    },
    competitive: {
      flash: { ...generic, payloadSchemaVersions: [1, 2] },
      survival: { ...generic, payloadSchemaVersions: [1, 2] },
      pyramid: { ...generic, payloadSchemaVersions: [1, 2] },
      narrative: { ...generic, payloadSchemaVersions: [1, 2] },
    },
  },
  "image-labeling": {
    id: "image-labeling",
    practice: { ...practice, rendererKey: "image-labeling" },
    scoringPolicyId: "image-labeling",
    validation: {
      publicValidatorKey: "image-labeling",
      solutionValidatorKey: "image-labeling",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  ordering: {
    id: "ordering",
    practice: { ...practice, rendererKey: "ordering" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "ordering",
      solutionValidatorKey: "ordering",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  classification: {
    id: "classification",
    practice: { ...practice, rendererKey: "classification" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "classification",
      solutionValidatorKey: "classification",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "flash-memory": {
    id: "flash-memory",
    practice: { ...practice, rendererKey: "flash-memory" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "flash-memory",
      solutionValidatorKey: "flash-memory",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  "memory-pairs": {
    id: "memory-pairs",
    practice: { ...practice, rendererKey: "memory-pairs" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "memory-pairs",
      solutionValidatorKey: "memory-pairs",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  "simon-sequence": {
    id: "simon-sequence",
    practice: { ...practice, rendererKey: "simon-sequence" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "simon-sequence",
      solutionValidatorKey: "simon-sequence",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  "logic-matrix": {
    id: "logic-matrix",
    practice: { ...practice, rendererKey: "logic-matrix" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "logic-matrix",
      solutionValidatorKey: "logic-matrix",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "mini-sudoku": {
    id: "mini-sudoku",
    practice: { ...practice, rendererKey: "mini-sudoku" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "mini-sudoku",
      solutionValidatorKey: "mini-sudoku",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  "mini-nonogram": {
    id: "mini-nonogram",
    practice: { ...practice, rendererKey: "mini-nonogram" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "mini-nonogram",
      solutionValidatorKey: "mini-nonogram",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  queens: {
    id: "queens",
    practice: { ...practice, rendererKey: "queens" },
    scoringPolicyId: "attempt-penalty",
    validation: {
      publicValidatorKey: "queens",
      solutionValidatorKey: "queens",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {
      flash: specialized("queens"),
      survival: specialized("queens"),
      pyramid: specialized("queens"),
      narrative: specialized("queens"),
    },
  },
  "time-maze": {
    id: "time-maze",
    practice: { ...practice, rendererKey: "time-maze" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "time-maze",
      solutionValidatorKey: "time-maze",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  zip: {
    id: "zip",
    practice: { ...practice, rendererKey: "zip" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "zip",
      solutionValidatorKey: "zip",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  pipes: {
    id: "pipes",
    practice: { ...practice, rendererKey: "pipes" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "pipes",
      solutionValidatorKey: "pipes",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  "sliding-puzzle": {
    id: "sliding-puzzle",
    practice: { ...practice, rendererKey: "sliding-puzzle" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "sliding-puzzle",
      solutionValidatorKey: "sliding-puzzle",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  escape: {
    id: "escape",
    practice: { ...practice, rendererKey: "escape" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "escape",
      solutionValidatorKey: "escape",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "error-reconstruction": {
    id: "error-reconstruction",
    practice: { ...practice, rendererKey: "error-reconstruction" },
    scoringPolicyId: "error-location-correction",
    validation: {
      publicValidatorKey: "error-reconstruction",
      solutionValidatorKey: "error-reconstruction",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {},
  },
  anagram: {
    id: "anagram",
    practice: { ...practice, rendererKey: "anagram" },
    scoringPolicyId: "binary-speed",
    validation: {
      publicValidatorKey: "anagram",
      solutionValidatorKey: "anagram",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
  },
  "word-hashtag": {
    id: "word-hashtag",
    practice: { ...practice, rendererKey: "word-hashtag" },
    scoringPolicyId: "movement-penalty",
    validation: {
      publicValidatorKey: "word-hashtag",
      solutionValidatorKey: "word-hashtag",
      payloadSchemaVersions: [1],
      ...competitiveExtension,
    },
    competitive: {
      flash: specialized("word-hashtag"),
      survival: specialized("word-hashtag"),
      pyramid: specialized("word-hashtag"),
      narrative: specialized("word-hashtag"),
    },
  },
  "word-search": {
    id: "word-search",
    practice: { ...practice, rendererKey: "word-search" },
    scoringPolicyId: "partial-items",
    validation: {
      publicValidatorKey: "word-search",
      solutionValidatorKey: "word-search",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {
      flash: specialized("word-search"),
      survival: specialized("word-search"),
      pyramid: specialized("word-search"),
      narrative: specialized("word-search"),
    },
  },
  "mini-wordle": {
    id: "mini-wordle",
    practice: { ...practice, rendererKey: "mini-wordle" },
    scoringPolicyId: "attempt-penalty",
    validation: {
      publicValidatorKey: "mini-wordle",
      solutionValidatorKey: "mini-wordle",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {
      flash: specialized("mini-wordle"),
      survival: specialized("mini-wordle"),
      pyramid: specialized("mini-wordle"),
      narrative: specialized("mini-wordle"),
    },
  },
  "logic-code": {
    id: "logic-code",
    practice: { ...practice, rendererKey: "logic-code" },
    scoringPolicyId: "attempt-penalty",
    validation: {
      publicValidatorKey: "logic-code",
      solutionValidatorKey: "logic-code",
      payloadSchemaVersions: [1],
      ...baseValidation,
    },
    competitive: {
      flash: specialized("logic-code"),
      survival: specialized("logic-code"),
      pyramid: specialized("logic-code"),
      narrative: specialized("logic-code"),
    },
  },
  estimation: {
    id: "estimation",
    practice: { ...practice, rendererKey: "estimation" },
    scoringPolicyId: "proximity",
    validation: {
      publicValidatorKey: "estimation",
      solutionValidatorKey: "estimation",
      payloadSchemaVersions: [2],
      ...baseValidation,
    },
    competitive: {
      flash: { ...generic, payloadSchemaVersions: [1, 2] },
      survival: { ...generic, payloadSchemaVersions: [1, 2] },
      pyramid: { ...generic, payloadSchemaVersions: [1, 2] },
      narrative: { ...generic, payloadSchemaVersions: [1, 2] },
    },
  },
} satisfies Record<QuestionType, FormatCapabilities>;

const capabilityMap = QUESTION_FORMAT_CAPABILITIES as Record<QuestionType, FormatCapabilities>;

export const QUESTION_FORMAT_TYPES = Object.keys(QUESTION_FORMAT_CAPABILITIES) as QuestionType[];

export function capabilityForQuestionType(type: QuestionType): FormatCapabilities {
  return capabilityMap[type];
}

export function competitiveCapabilityFor(
  type: QuestionType,
  mode: GameMode,
): CompetitiveFormatCapability | null {
  return capabilityMap[type].competitive[mode] ?? null;
}

export function competitiveQuestionTypesFor(mode: GameMode): readonly QuestionType[] {
  return QUESTION_FORMAT_TYPES.filter(
    (type) => capabilityMap[type].competitive[mode] !== undefined,
  );
}

export function isCompetitiveQuestionType(type: QuestionType, mode?: GameMode): boolean {
  return mode
    ? competitiveCapabilityFor(type, mode) !== null
    : Object.values(capabilityMap[type].competitive).length > 0;
}

export function competitivePayloadSchemaVersionsFor(
  type: QuestionType,
  mode?: GameMode,
): readonly number[] {
  if (mode) return competitiveCapabilityFor(type, mode)?.payloadSchemaVersions ?? [];
  return [
    ...new Set(
      Object.values(capabilityMap[type].competitive).flatMap(
        (capability) => capability.payloadSchemaVersions,
      ),
    ),
  ];
}

export const COMPETITIVE_SQL_EXTENSION_TYPES = QUESTION_FORMAT_TYPES.filter(
  (type) => capabilityMap[type].validation.sqlValidation === "competitive-extension",
);
