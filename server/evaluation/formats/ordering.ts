import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"ordering">;
  const { solution, points } = input;
  const orderingSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, orderingSolution, points),
    type: publicQuestion.type,
    items: [...publicQuestion.payload.items],
    correctOrder: [...orderingSolution.payload.correctOrder],
    ...(publicQuestion.payload.directionLabels
      ? { directionLabels: publicQuestion.payload.directionLabels }
      : {}),
  } satisfies ResolvedQuestionOfType<"ordering">;
}
