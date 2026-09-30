import type { EvaluationContext } from "@/application/ports/attempt-commands";
import type { AnswerStatus } from "@/types/domain/attempt";
import type { AnswerResultDetails } from "@/types/contracts/result-details";
import type { PublicQuestion, QuestionReveal, QuestionSolution } from "@/types/contracts";

export type CompetitiveQuestionResolutionInput = {
  readonly publicQuestion: PublicQuestion;
  readonly solution: QuestionSolution;
  readonly points: number;
  readonly reveals?: readonly QuestionReveal[];
};

export type CompetitiveEvaluationResult = {
  readonly status: AnswerStatus;
  readonly points: number;
  readonly details?: AnswerResultDetails;
};

export interface CompetitiveEvaluator {
  evaluate(context: EvaluationContext): CompetitiveEvaluationResult;
}
