import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "ordering",
  practice: { ...practice, rendererKey: "ordering" },
  scoringPolicyId: "partial-items",
  validation: {
    publicValidatorKey: "ordering",
    solutionValidatorKey: "ordering",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"ordering">;
