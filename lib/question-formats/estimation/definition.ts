import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"estimation">;
