import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "escape",
  practice: { ...practice, rendererKey: "escape" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "escape",
    solutionValidatorKey: "escape",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"escape">;
