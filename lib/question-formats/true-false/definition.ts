import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "true-false",
  practice: { ...practice, rendererKey: "true-false" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "true-false",
    solutionValidatorKey: "true-false",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"true-false">;
