import type {
  ResolvedAnswerValue,
  MultipleChoiceQuestion,
  ResolvedQuestion,
} from "@/types/gameplay/scoring";
import { calculateQuestionScore, CHOICE_PENALTY_RATIO } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: ResolvedQuestion): MultipleChoiceQuestion {
  return question as MultipleChoiceQuestion;
}

function isCorrect(question: ResolvedQuestion, answer: ResolvedAnswerValue) {
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
    points: calculateQuestionScore(question, correct, timeUsed, {
      incorrectPenaltyRatio: CHOICE_PENALTY_RATIO,
    }),
  };
}

export const scoring = {
  questionType: "multiple-choice",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateMultipleChoice,
} as const satisfies QuestionScoring;
