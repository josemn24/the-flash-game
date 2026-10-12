import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "logic-matrix",
  practice: { ...practice, rendererKey: "logic-matrix" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "logic-matrix",
    solutionValidatorKey: "logic-matrix",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"logic-matrix">;
