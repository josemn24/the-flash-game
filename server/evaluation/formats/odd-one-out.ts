import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"odd-one-out">;
  const { solution, points } = input;
  const oddOneOutSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, oddOneOutSolution, points),
    type: publicQuestion.type,
    items: [...publicQuestion.payload.items],
    correctAnswer: oddOneOutSolution.payload.correctAnswer,
  } satisfies ResolvedQuestionOfType<"odd-one-out">;
}
