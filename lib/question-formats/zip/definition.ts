import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "zip",
  practice: { ...practice, rendererKey: "zip" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "zip",
    solutionValidatorKey: "zip",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"zip">;
