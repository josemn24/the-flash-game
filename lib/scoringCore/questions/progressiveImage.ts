import type {
  ResolvedAnswerValue,
  ProgressiveImageQuestion,
  ResolvedQuestion,
} from "@/types/gameplay/scoring";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { isValidProgressiveImageConfiguration } from "@/lib/progressiveImage";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: ResolvedQuestion): ProgressiveImageQuestion {
  return question as ProgressiveImageQuestion;
}

function isCorrect(question: ResolvedQuestion, answer: ResolvedAnswerValue) {
  const imageQuestion = asQuestion(question);
  if (typeof answer !== "string" || !isValidProgressiveImageConfiguration(imageQuestion)) {
    return false;
  }
  const normalizedAnswer = normalizeAnswer(answer);
  return (imageQuestion.acceptedAnswers ?? [imageQuestion.correctAnswer]).some(
    (candidate) => normalizeAnswer(candidate) === normalizedAnswer,
  );
}

export function evaluateProgressiveImage({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const correct = isCorrect(question, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: calculateQuestionScore(question, correct, timeUsed),
  };
}

export const scoring = {
  questionType: "progressive-image",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateProgressiveImage,
} as const satisfies QuestionScoring;
