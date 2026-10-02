import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "connect-pairs",
  practice: { ...practice, rendererKey: "connect-pairs" },
  scoringPolicyId: "partial-items",
  validation: {
    publicValidatorKey: "connect-pairs",
    solutionValidatorKey: "connect-pairs",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"connect-pairs">;
