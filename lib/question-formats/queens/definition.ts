import { baseValidation, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
    "time-trial": specialized("queens"),
    flash: specialized("queens"),
    survival: specialized("queens"),
    pyramid: specialized("queens"),
    narrative: specialized("queens"),
  },
} as const satisfies FormatDefinition<"queens">;
