import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"true-false">;
  const { solution, points } = input;
  const trueFalseSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, trueFalseSolution, points),
    type: publicQuestion.type,
    correctAnswer: trueFalseSolution.payload.correctAnswer,
  } satisfies ResolvedQuestionOfType<"true-false">;
}
