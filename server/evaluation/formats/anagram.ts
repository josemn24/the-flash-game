import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"anagram">;
  const { solution, points } = input;
  const anagramSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, anagramSolution, points),
    type: publicQuestion.type,
    tiles: [...publicQuestion.payload.tiles],
    correctAnswer: anagramSolution.payload.correctAnswer,
    ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
  } satisfies ResolvedQuestionOfType<"anagram">;
}
