import type { ServerTimeTrialChallenge } from "@/types/gameplay/challenge";
import type { LocalQuestionLevel } from "@/types/gameplay/local-pyramid";

/** Private local fixture. Its solutions stay behind the in-memory provider. */
export type LocalTimeTrialDefinition = {
  readonly challenge: ServerTimeTrialChallenge;
  readonly levels: readonly LocalQuestionLevel[];
};
