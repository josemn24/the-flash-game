import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"estimation">;
  const { solution, points } = input;
  const estimationSolution = solutionFor(solution, publicQuestion.type);
  const { media, ...estimationPayload } = publicQuestion.payload;
  return {
    ...baseQuestion(publicQuestion, estimationSolution, points),
    type: publicQuestion.type,
    ...estimationPayload,
    ...(media === null ? {} : { media }),
    correctAnswer: estimationSolution.payload.correctAnswer,
    tolerance: estimationSolution.payload.tolerance,
  } satisfies ResolvedQuestionOfType<"estimation">;
}
