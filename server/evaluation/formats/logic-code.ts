import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"logic-code">;
  const { solution, points } = input;
  const logicCodeSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, logicCodeSolution, points),
    type: publicQuestion.type,
    clues: [...publicQuestion.payload.clues],
    codeLength: publicQuestion.payload.codeLength,
    correctAnswer: logicCodeSolution.payload.correctAnswer,
  } satisfies ResolvedQuestionOfType<"logic-code">;
}
