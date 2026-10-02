import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"progressive-image">;
