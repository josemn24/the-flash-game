import type { QuestionType } from "@/types/contracts/questions";
import type { CompetitiveAdapterKey } from "./capabilities";

/**
 * The validators currently live in the editorial parser and the server
 * normalization switch. These registries give the capability manifest a
 * stable, implementation-independent key to validate against while those
 * implementations are migrated incrementally.
 */
export const FORMAT_PUBLIC_VALIDATORS = {
  "multiple-choice": true,
  "odd-one-out": true,
  matching: true,
  "connect-pairs": true,
  "true-false": true,
  "short-text": true,
  "progressive-clues": true,
  "progressive-image": true,
  "heat-map": true,
  "image-labeling": true,
  ordering: true,
  classification: true,
  "flash-memory": true,
  "memory-pairs": true,
  "simon-sequence": true,
  "logic-matrix": true,
  "mini-sudoku": true,
  "mini-nonogram": true,
  queens: true,
  "time-maze": true,
  zip: true,
  pipes: true,
  "sliding-puzzle": true,
  escape: true,
  "error-reconstruction": true,
  anagram: true,
  "word-hashtag": true,
  "word-search": true,
  "mini-wordle": true,
  "logic-code": true,
  estimation: true,
} as const satisfies Record<QuestionType, true>;

export const FORMAT_SOLUTION_VALIDATORS = FORMAT_PUBLIC_VALIDATORS;

export const COMPETITIVE_ADAPTERS = {
  generic: true,
  "alphabet-pass": true,
  "mini-wordle": true,
  "logic-code": true,
  "progressive-clues": true,
  queens: true,
  "word-search": true,
  "word-hashtag": true,
} as const satisfies Record<CompetitiveAdapterKey, true>;
