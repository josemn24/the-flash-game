import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
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
} as const satisfies FormatDefinition<"heat-map">;
