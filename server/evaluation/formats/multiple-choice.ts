import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"multiple-choice">;
  const { solution, points } = input;
  const multipleChoiceSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, multipleChoiceSolution, points),
    type: publicQuestion.type,
    options: [...publicQuestion.payload.options],
    ...(publicQuestion.payload.media ? { media: publicQuestion.payload.media } : {}),
    ...(publicQuestion.payload.promptVisual
      ? { promptVisual: publicQuestion.payload.promptVisual }
      : {}),
    correctAnswer: multipleChoiceSolution.payload.correctAnswer,
  } satisfies ResolvedQuestionOfType<"multiple-choice">;
}
