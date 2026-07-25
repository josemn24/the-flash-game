import type { AnswerValue, TrueFalseQuestion, Question } from "@/types/game";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): TrueFalseQuestion {
  return question as TrueFalseQuestion;
}

function isCorrect(question: Question, answer: AnswerValue) {
  return answer === asQuestion(question).correctAnswer;
}

export function evaluateTrueFalse({
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
  questionType: "true-false",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "boolean",
  isCorrect,
  evaluate: evaluateTrueFalse,
} as const satisfies QuestionScoring;
