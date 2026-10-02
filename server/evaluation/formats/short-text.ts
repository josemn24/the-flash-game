import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"short-text">;
  const { solution, points } = input;
  const shortTextSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, shortTextSolution, points),
    type: publicQuestion.type,
    correctAnswer: shortTextSolution.payload.correctAnswer,
    acceptedAnswers: [...shortTextSolution.payload.acceptedAnswers],
  } satisfies ResolvedQuestionOfType<"short-text">;
}
