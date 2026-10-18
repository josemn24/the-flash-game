import type { PublicQuestion, QuestionSolution, QuestionReveal } from "@/types/contracts";
import type {
  ServerFlashChallenge,
  ServerPyramidChallenge,
  ServerSurvivalChallenge,
} from "@/types/gameplay/challenge";

/** Private fixture input. Never pass this definition to a view or public session update. */
export type LocalQuestionLevel = {
  readonly challengeItemId: string;
  readonly payloadSchemaVersion: number;
  readonly publicQuestion: PublicQuestion;
  readonly solution: QuestionSolution;
  readonly reveals?: readonly QuestionReveal[];
};
export type LocalPyramidLevel = LocalQuestionLevel;
export type LocalPyramidDefinition = {
  readonly challenge: ServerPyramidChallenge;
  readonly levels: readonly LocalPyramidLevel[];
};

export type LocalFlashDefinition = {
  readonly challenge: ServerFlashChallenge;
  readonly levels: readonly LocalQuestionLevel[];
};

export type LocalSurvivalDefinition = {
  readonly challenge: ServerSurvivalChallenge;
  readonly levels: readonly LocalQuestionLevel[];
};

