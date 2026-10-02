import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "multiple-choice",
  practice: { ...practice, rendererKey: "multiple-choice" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "multiple-choice",
    solutionValidatorKey: "multiple-choice",
    payloadSchemaVersions: [1, 2],
    ...baseValidation,
  },
  competitive: {
    flash: { ...generic, payloadSchemaVersions: [1, 2] },
    survival: { ...generic, payloadSchemaVersions: [1, 2] },
    pyramid: { ...generic, payloadSchemaVersions: [1, 2] },
    narrative: { ...generic, payloadSchemaVersions: [1, 2] },
  },
} as const satisfies FormatDefinition<"multiple-choice">;
