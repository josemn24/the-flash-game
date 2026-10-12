import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"classification">;
  const { solution, points } = input;
  const classificationSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, classificationSolution, points),
    type: publicQuestion.type,
    categories: [...publicQuestion.payload.categories],
    items: publicQuestion.payload.items.map((item) => ({
      ...item,
      correctCategory: classificationSolution.payload.categoriesByItem[item.label],
    })),
  } satisfies ResolvedQuestionOfType<"classification">;
}
