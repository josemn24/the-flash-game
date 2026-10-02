import { baseValidation, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"word-search">;
