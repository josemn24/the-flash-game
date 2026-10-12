import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "matching",
  practice: { ...practice, rendererKey: "matching" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "matching",
    solutionValidatorKey: "matching",
    payloadSchemaVersions: [1],
    ...baseValidation,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"matching">;
