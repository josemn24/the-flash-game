import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"zip">;
  const { solution, points } = input;
  const zipSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, zipSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    checkpoints: [...publicQuestion.payload.checkpoints],
    solution: [...zipSolution.payload.solution],
    ...(publicQuestion.payload.instruction === null
      ? {}
      : { instruction: publicQuestion.payload.instruction }),
    ...(publicQuestion.payload.mapNote === null ? {} : { mapNote: publicQuestion.payload.mapNote }),
    ...(publicQuestion.payload.boardLabel === null
      ? {}
      : { boardLabel: publicQuestion.payload.boardLabel }),
  } satisfies ResolvedQuestionOfType<"zip">;
}
