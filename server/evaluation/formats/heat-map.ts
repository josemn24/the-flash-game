import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"heat-map">;
  const { solution, points } = input;
  const heatMapSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, heatMapSolution, points),
    type: publicQuestion.type,
    surface: publicQuestion.payload.surface,
    targetLabel: publicQuestion.payload.targetLabel,
    target: heatMapSolution.payload.target,
    fullCreditRadius: heatMapSolution.payload.fullCreditRadius,
    toleranceRadius: heatMapSolution.payload.toleranceRadius,
  } satisfies ResolvedQuestionOfType<"heat-map">;
}
