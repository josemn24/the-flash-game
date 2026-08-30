import type { AnswerValue, OddOneOutQuestion, Question } from "@/types/game";
import { calculateQuestionScore, CHOICE_PENALTY_RATIO } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): OddOneOutQuestion {
  return question as OddOneOutQuestion;
}

function isCorrect(question: Question, answer: AnswerValue) {
  return typeof answer === "string" && answer === asQuestion(question).correctAnswer;
}

export function evaluateOddOneOut({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const correct = isCorrect(question, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: calculateQuestionScore(question, correct, timeUsed, {
      incorrectPenaltyRatio: CHOICE_PENALTY_RATIO,
    }),
  };
}

export const scoring = {
  questionType: "odd-one-out",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateOddOneOut,
} as const satisfies QuestionScoring;
