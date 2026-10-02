import { baseValidation, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"mini-wordle">;
