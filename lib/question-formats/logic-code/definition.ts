import { baseValidation, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"logic-code">;
