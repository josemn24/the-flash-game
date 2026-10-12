import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"mini-wordle">;
  const { solution, points } = input;
  const miniWordleSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, miniWordleSolution, points),
    type: publicQuestion.type,
    correctAnswer: miniWordleSolution.payload.correctAnswer,
    additionalGuesses: [...miniWordleSolution.payload.additionalGuesses],
    dictionaryId: miniWordleSolution.payload.dictionaryId,
    ...(publicQuestion.payload.hint === null ? {} : { hint: publicQuestion.payload.hint }),
    wordLength: publicQuestion.payload.wordLength,
    maxAttempts: publicQuestion.payload.maxAttempts,
  } satisfies ResolvedQuestionOfType<"mini-wordle">;
}
