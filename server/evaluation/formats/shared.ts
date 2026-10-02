import type {
  PublicQuestion,
  PublicQuestionOfType,
  QuestionReveal,
  QuestionSolution,
  QuestionSolutionOfType,
  QuestionType,
} from "@/types/contracts";
import type { ResolvedBaseQuestion } from "@/types/gameplay/scoring";
import "server-only";
export type ResolvedQuestionInput<Type extends QuestionType = QuestionType> = {
  readonly publicQuestion: PublicQuestionOfType<Type>;
  readonly solution: QuestionSolutionOfType<Type>;
  readonly points: number;
  readonly reveals?: readonly QuestionReveal[];
};
export type CanonicalQuestionResolutionInput = {
  readonly publicQuestion: PublicQuestion;
  readonly solution: QuestionSolution;
  readonly points: number;
  readonly reveals?: readonly QuestionReveal[];
};
export function baseQuestion<Type extends QuestionType>(
  publicQuestion: PublicQuestionOfType<Type>,
  solution: QuestionSolutionOfType<Type>,
  points: number,
): ResolvedBaseQuestion {
  return {
    id: publicQuestion.id,
    category: publicQuestion.category,
    tags: publicQuestion.tags,
    question: publicQuestion.prompt,
    ...(publicQuestion.context === null ? {} : { questionContext: publicQuestion.context }),
    timeLimit: publicQuestion.timeLimitMs / 1_000,
    points,
    explanation: solution.explanation,
  };
}
export function memoryPairReveals(reveals: readonly QuestionReveal[] | undefined) {
  return new Map(
    (reveals ?? [])
      .filter((reveal) => reveal.type === "memory-pairs")
      .map((reveal) => [reveal.payload.tile.id, reveal.payload.tile] as const),
  );
}
export function isSolutionOfType<Type extends QuestionType>(
  solution: QuestionSolution,
  type: Type,
): solution is QuestionSolution & QuestionSolutionOfType<Type> {
  return solution.type === type;
}
export function solutionFor<Type extends QuestionType>(
  solution: QuestionSolution,
  type: Type,
): QuestionSolutionOfType<Type> {
  if (!isSolutionOfType(solution, type)) {
    throw new Error(`Mismatched public and solution contracts for ${type}`);
  }

  return solution;
}
