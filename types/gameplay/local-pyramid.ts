import type { PublicQuestion, QuestionSolution, QuestionReveal } from "@/types/contracts";
import type { ServerPyramidChallenge } from "@/types/gameplay/challenge";

/** Private fixture input. Never pass this definition to a view or public session update. */
export type LocalPyramidLevel = {
  readonly challengeItemId: string;
  readonly payloadSchemaVersion: number;
  readonly publicQuestion: PublicQuestion;
  readonly solution: QuestionSolution;
  readonly reveals?: readonly QuestionReveal[];
};
export type LocalPyramidDefinition = {
  readonly challenge: ServerPyramidChallenge;
  readonly levels: readonly LocalPyramidLevel[];
};
