import type { AnswerValue, OrderingQuestion, Question } from "@/types/game";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): OrderingQuestion {
  return question as OrderingQuestion;
}

function isOrderingAnswer(
  question: OrderingQuestion,
  answer: AnswerValue | null,
): answer is string[] {
  return (
    Array.isArray(answer) &&
    answer.length === question.correctOrder.length &&
    answer.every((item) => typeof item === "string")
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const orderingQuestion = asQuestion(question);
  return (
    Array.isArray(answer) &&
    answer.length === orderingQuestion.correctOrder.length &&
    answer.every((item, index) => item === orderingQuestion.correctOrder[index])
  );
}

export function evaluateOrdering({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const orderingQuestion = asQuestion(question);
  if (!isOrderingAnswer(orderingQuestion, answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const correctItems = answer.filter(
    (item, index) => item === orderingQuestion.correctOrder[index],
  ).length;
  const totalItems = orderingQuestion.correctOrder.length;
  const correct = correctItems === totalItems;

  return {
    isCorrect: correct,
    status: correct ? "correct" : correctItems > 0 ? "partial" : "incorrect",
    points:
      correctItems > 0
        ? calculateProportionalScore(
            orderingQuestion.points,
            correctItems,
            totalItems,
            calculateSpeedMultiplier(timeUsed, orderingQuestion.timeLimit),
          )
        : 0,
  };
}

export const scoring = {
  questionType: "ordering",
  policy: "partial-items",
  isAnswer: (answer) => Array.isArray(answer) && answer.every((item) => typeof item === "string"),
  isCorrect,
  evaluate: evaluateOrdering,
} as const satisfies QuestionScoring;
