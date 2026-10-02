import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"queens">;
  const { solution, points } = input;
  const queensSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, queensSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    regions: [...publicQuestion.payload.regions],
    ...(publicQuestion.payload.prefilledQueens.length > 0
      ? { prefilledQueens: [...publicQuestion.payload.prefilledQueens] }
      : {}),
    solution: [...queensSolution.payload.solution],
  } satisfies ResolvedQuestionOfType<"queens">;
}
