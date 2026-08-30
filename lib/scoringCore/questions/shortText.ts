import type { AnswerValue, Question, ShortTextQuestion } from "@/types/game";
import { normalizeAnswer } from "@/lib/normalizeAnswer";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): ShortTextQuestion {
  return question as ShortTextQuestion;
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (typeof answer !== "string") return false;
  const shortTextQuestion = asQuestion(question);
  const accepted = shortTextQuestion.acceptedAnswers ?? [shortTextQuestion.correctAnswer];
  const normalizedAnswer = normalizeAnswer(answer);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
}

export function evaluateShortText({
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
  questionType: "short-text",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateShortText,
} as const satisfies QuestionScoring;
