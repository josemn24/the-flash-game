import { baseValidation, generic, practice } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "anagram",
  practice: { ...practice, rendererKey: "anagram" },
  scoringPolicyId: "binary-speed",
  validation: {
    publicValidatorKey: "anagram",
    solutionValidatorKey: "anagram",
    payloadSchemaVersions: [1],
    ...baseValidation,
  },
  competitive: { flash: generic, survival: generic, pyramid: generic, narrative: generic },
} as const satisfies FormatDefinition<"anagram">;
