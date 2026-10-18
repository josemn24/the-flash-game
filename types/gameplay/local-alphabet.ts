import type { ServerAlphabetChallenge } from "@/types/gameplay/challenge";
import type { LocalQuestionLevel } from "@/types/gameplay/local-pyramid";

/** Private local fixture for the Alphabet rehearsal. Never pass solutions to a view. */
export type LocalAlphabetDefinition = {
  readonly challenge: ServerAlphabetChallenge;
  readonly levels: readonly LocalQuestionLevel[];
};
