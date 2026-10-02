import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"progressive-image">;
  const { solution, points } = input;
  const progressiveImageSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, progressiveImageSolution, points),
    type: publicQuestion.type,
    surface: publicQuestion.payload.surface,
    solutionAlt: progressiveImageSolution.payload.solutionAlt,
    revealDuration: publicQuestion.payload.revealDurationMs / 1_000,
    correctAnswer: progressiveImageSolution.payload.correctAnswer,
    acceptedAnswers: [...progressiveImageSolution.payload.acceptedAnswers],
    ...(publicQuestion.payload.answerLabel === null
      ? {}
      : { answerLabel: publicQuestion.payload.answerLabel }),
    ...(publicQuestion.payload.answerPlaceholder === null
      ? {}
      : { answerPlaceholder: publicQuestion.payload.answerPlaceholder }),
  } satisfies ResolvedQuestionOfType<"progressive-image">;
}
