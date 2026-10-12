import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"word-search">;
  const { solution, points } = input;
  const wordSearchSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, wordSearchSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    letters: [...publicQuestion.payload.letters],
    targets: publicQuestion.payload.targets.map((target) => ({
      ...target,
      ...wordSearchSolution.payload.positionsByTargetId[target.id],
    })),
  } satisfies ResolvedQuestionOfType<"word-search">;
}
