import type { PublicQuestionOfType } from "@/types/contracts/questions";
import type { ResolvedQuestionOfType } from "@/types/gameplay/scoring";
import "server-only";
import { baseQuestion, solutionFor, type CanonicalQuestionResolutionInput } from "./shared";
export function resolve(input: CanonicalQuestionResolutionInput) {
  const publicQuestion = input.publicQuestion as PublicQuestionOfType<"progressive-clues">;
  const { solution, reveals, points } = input;
  const progressiveCluesSolution = solutionFor(solution, publicQuestion.type);
  const cluesByIndex = new Map(
    (reveals ?? [])
      .filter((reveal) => reveal.type === "progressive-clues")
      .map((reveal) => [reveal.payload.clueIndex, reveal.payload.clue] as const),
  );
  return {
    ...baseQuestion(publicQuestion, progressiveCluesSolution, points),
    type: publicQuestion.type,
    clues: Array.from(
      { length: publicQuestion.payload.clueCount },
      (_, index) => cluesByIndex.get(index) ?? `clue-${index + 1}`,
    ),
    cluePenalty: publicQuestion.payload.cluePenalty,
    correctAnswer: progressiveCluesSolution.payload.correctAnswer,
    acceptedAnswers: [...progressiveCluesSolution.payload.acceptedAnswers],
  } satisfies ResolvedQuestionOfType<"progressive-clues">;
}
