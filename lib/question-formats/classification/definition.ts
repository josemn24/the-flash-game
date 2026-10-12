import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "classification",
  practice: { ...practice, rendererKey: "classification" },
  scoringPolicyId: "partial-items",
  validation: {
    publicValidatorKey: "classification",
    solutionValidatorKey: "classification",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"classification">;
