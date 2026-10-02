import { alphabetPass, baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "short-text",
  practice: { ...practice, rendererKey: "short-text" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "short-text",
    solutionValidatorKey: "short-text",
    payloadSchemaVersions: [1],
    ...baseValidation,
  },
  competitive: { flash: generic, pyramid: generic, alphabet: alphabetPass },
} as const satisfies FormatDefinition<"short-text">;
