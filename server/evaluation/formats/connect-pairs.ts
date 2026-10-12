import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"connect-pairs">;
  const { solution, points } = input;
  const connectPairsSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, connectPairsSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    pairs: [...publicQuestion.payload.pairs],
    solutionPaths: Object.fromEntries(
      Object.entries(connectPairsSolution.payload.paths).map(([id, path]) => [id, [...path]]),
    ),
    requireFullCoverage: publicQuestion.payload.requireFullCoverage,
  } satisfies ResolvedQuestionOfType<"connect-pairs">;
}
