import { competitiveExtension, practice, specialized } from "../metadata";
import type { FormatDefinition } from "../types";
export const definition = {
  id: "word-hashtag",
  practice: { ...practice, rendererKey: "word-hashtag" },
  scoringPolicyId: "movement-penalty",
  validation: {
    publicValidatorKey: "word-hashtag",
    solutionValidatorKey: "word-hashtag",
    payloadSchemaVersions: [1],
    ...competitiveExtension,
  },
  competitive: {
    flash: specialized("word-hashtag"),
    survival: specialized("word-hashtag"),
    pyramid: specialized("word-hashtag"),
    narrative: specialized("word-hashtag"),
  },
} as const satisfies FormatDefinition<"word-hashtag">;
