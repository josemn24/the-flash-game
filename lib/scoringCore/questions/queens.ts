import type {
  AnswerResultDetails,
  AnswerValue,
  QueensAnswer,
  QueensQuestion,
  Question,
} from "@/types/game";
import { calculateQueensMetrics, isQueensAnswer, isValidQueensConfiguration } from "@/lib/queens";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

export const QUEENS_MISTAKE_PENALTY_RATIO = 0.05;

function asQuestion(question: Question): QueensQuestion {
  return question as QueensQuestion;
}

function detailsFor(
  question: QueensQuestion,
  answer: QueensAnswer,
  incorrectAttempts: number,
): AnswerResultDetails {
  const metrics = calculateQueensMetrics(question, answer);
  return {
    type: "queens",
    placedQueens: metrics.placedQueens,
    completedRows: metrics.completedRows,
    completedColumns: metrics.completedColumns,
    completedRegions: metrics.completedRegions,
    conflictingQueens: metrics.conflictingQueens,
    incorrectAttempts,
    marksUsed: metrics.marksUsed,
    solved: metrics.solved,
  };
}

function unansweredDetails(
  question: Question,
  context: { incorrectAttempts: number },
): AnswerResultDetails {
  return detailsFor(asQuestion(question), { queens: [], marks: [] }, context.incorrectAttempts);
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isQueensAnswer(answer) &&
    isValidQueensConfiguration(asQuestion(question)) &&
    calculateQueensMetrics(asQuestion(question), answer).solved
  );
}

export function evaluateQueens({
  question,
  answer,
  timeUsed,
  incorrectAttempts,
}: EvaluationContext): InternalEvaluation {
  const queensQuestion = asQuestion(question);
  if (!isQueensAnswer(answer) || !isValidQueensConfiguration(queensQuestion)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateQueensMetrics(queensQuestion, answer);
  const speedScore = metrics.solved ? calculateQuestionScore(queensQuestion, true, timeUsed) : 0;
  const penalty =
    Math.round(queensQuestion.points * QUEENS_MISTAKE_PENALTY_RATIO) *
    Math.max(0, incorrectAttempts);
  return {
    isCorrect: metrics.solved,
    status: metrics.solved ? "correct" : metrics.placedQueens > 0 ? "partial" : "incorrect",
    points: Math.max(0, speedScore - penalty),
    details: detailsFor(queensQuestion, answer, incorrectAttempts),
  };
}

export const scoring = {
  questionType: "queens",
  policy: "attempt-penalty",
  timeoutPolicy: {
    answerSource: "draft",
    unansweredDetails,
    status: () => "unanswered",
  },
  isAnswer: isQueensAnswer,
  isCorrect,
  evaluate: evaluateQueens,
} as const satisfies QuestionScoring;
