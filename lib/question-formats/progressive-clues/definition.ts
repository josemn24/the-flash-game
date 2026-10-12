import { baseValidation, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"progressive-clues">;
