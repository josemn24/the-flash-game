import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"matching">;
  const { solution, points } = input;
  const matchingSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, matchingSolution, points),
    type: publicQuestion.type,
    leftItems: publicQuestion.payload.leftItems.map((item) => ({
      ...item,
      correctMatchId: matchingSolution.payload.matches[item.id],
    })),
    rightItems: [...publicQuestion.payload.rightItems],
  } satisfies ResolvedQuestionOfType<"matching">;
}
