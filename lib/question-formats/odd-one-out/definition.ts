import { competitiveExtension, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "odd-one-out",
  practice: { ...practice, rendererKey: "odd-one-out" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "odd-one-out",
    solutionValidatorKey: "odd-one-out",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"odd-one-out">;
