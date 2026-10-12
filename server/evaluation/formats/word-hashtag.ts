import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"word-hashtag">;
  const { solution, points } = input;
  const wordHashtagSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, wordHashtagSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    initialLetters: [...publicQuestion.payload.initialLetters],
    maxMoves: publicQuestion.payload.maxMoves,
    words: wordHashtagSolution.payload.words,
  } satisfies ResolvedQuestionOfType<"word-hashtag">;
}
