import type { AnswerValue, MultipleChoiceQuestion, Question } from "@/types/game";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MultipleChoiceQuestion {
  return question as MultipleChoiceQuestion;
}

function isCorrect(question: Question, answer: AnswerValue) {
  return typeof answer === "string" && answer === asQuestion(question).correctAnswer;
}

export function evaluateMultipleChoice({
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
  questionType: "multiple-choice",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateMultipleChoice,
} as const satisfies QuestionScoring;
