import {
  calculateResolvedAnswerScore,
  evaluateResolvedAnswer,
  getResolvedTimedOutAnswer,
  isResolvedAnswerCorrect,
} from "@/lib/scoringCore/engine";
import type { EvaluationInput } from "@/lib/scoringCore/types";
import type { PracticeAnswerValue, PracticeQuestion } from "@/types/gameplay/practice";
import type { AnswerResult } from "@/types/gameplay/result";
import type { ResolvedAnswerValue, ResolvedQuestion } from "@/types/gameplay/scoring";

/** Input accepted by local practice and preview scoring. */
export type PracticeEvaluationInput = Omit<EvaluationInput, "question" | "answer"> & {
  readonly question: PracticeQuestion;
  readonly answer: PracticeAnswerValue | null;
};

/**
 * Practice questions predate the canonical scoring projection and may omit
 * optional life-skill tags. Normalize that difference only at this boundary.
 */
export function resolvePracticeQuestion(question: PracticeQuestion): ResolvedQuestion {
  return {
    ...question,
    tags: {
      ...question.tags,
      lifeSkills: question.tags.lifeSkills ?? [],
    },
  } as ResolvedQuestion;
}

function resolvePracticeAnswer(answer: PracticeAnswerValue | null): ResolvedAnswerValue | null {
  return answer as ResolvedAnswerValue | null;
}

export function evaluatePracticeAnswer(input: PracticeEvaluationInput): AnswerResult {
  return evaluateResolvedAnswer({
    ...input,
    question: resolvePracticeQuestion(input.question),
    answer: resolvePracticeAnswer(input.answer),
  });
}

export function isAnswerCorrect(question: PracticeQuestion, answer: PracticeAnswerValue): boolean {
  return isResolvedAnswerCorrect(resolvePracticeQuestion(question), resolvePracticeAnswer(answer)!);
}

export function calculateAnswerScore(
  question: PracticeQuestion,
  answer: PracticeAnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
  revealedClues = 1,
) {
  return calculateResolvedAnswerScore(
    resolvePracticeQuestion(question),
    resolvePracticeAnswer(answer)!,
    timeUsed,
    incorrectAttempts,
    revealedClues,
  );
}

export function getTimedOutAnswer(
  question: PracticeQuestion,
  {
    draftAnswer,
    submittedCodes,
  }: {
    draftAnswer: PracticeAnswerValue | null;
    submittedCodes: string[];
  },
): PracticeAnswerValue | null {
  return getResolvedTimedOutAnswer(resolvePracticeQuestion(question), {
    draftAnswer: resolvePracticeAnswer(draftAnswer),
    submittedCodes,
  }) as PracticeAnswerValue | null;
}

/** @deprecated Use `evaluatePracticeAnswer` for local practice and previews. */
export const evaluateAnswer = evaluatePracticeAnswer;
