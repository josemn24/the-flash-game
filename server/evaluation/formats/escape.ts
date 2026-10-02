import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"escape">;
  const { solution, points } = input;
  const escapeSolution = solutionFor(solution, publicQuestion.type);
  return {
    ...baseQuestion(publicQuestion, escapeSolution, points),
    type: publicQuestion.type,
    grid: publicQuestion.payload.grid,
    initialBlocks: [...publicQuestion.payload.initialBlocks],
    referenceSolution: [...escapeSolution.payload.referenceSolution],
    optimalMoves: escapeSolution.payload.optimalMoves,
    ...(publicQuestion.payload.instruction === null
      ? {}
      : { instruction: publicQuestion.payload.instruction }),
    hideInstruction: publicQuestion.payload.hideInstruction,
    ...(publicQuestion.payload.objectiveLabel === null
      ? {}
      : { objectiveLabel: publicQuestion.payload.objectiveLabel }),
    hideObjectiveLabel: publicQuestion.payload.hideObjectiveLabel,
    ...(publicQuestion.payload.completionMessage === null
      ? {}
      : { completionMessage: publicQuestion.payload.completionMessage }),
    ...(publicQuestion.payload.boardLabel === null
      ? {}
      : { boardLabel: publicQuestion.payload.boardLabel }),
  } satisfies ResolvedQuestionOfType<"escape">;
}
