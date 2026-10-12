import "server-only";
import type { QuestionType } from "@/types/contracts";
import type { ResolvedQuestion, ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import type { ResolvedQuestionInput, CanonicalQuestionResolutionInput } from "./formats/shared";
import { COMPETITIVE_RESOLVERS } from "./formats/registry";
import { isCompetitiveQuestionType } from "@/lib/question-formats/definitions";
import { resolvePracticeQuestion } from "./formats/practiceResolution";
export function resolveCompetitiveQuestion<Type extends QuestionType>(
  input: ResolvedQuestionInput<Type>,
): ResolvedQuestionOfType<Type>;
export function resolveCompetitiveQuestion({
  publicQuestion,
  solution,
  points,
  reveals,
}: CanonicalQuestionResolutionInput): ResolvedQuestion {
  const input = { publicQuestion, solution, points, reveals };
  return isCompetitiveQuestionType(publicQuestion.type)
    ? COMPETITIVE_RESOLVERS[publicQuestion.type](input)
    : resolvePracticeQuestion(input);
}
