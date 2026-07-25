import type { AnswerValue, LogicMatrixQuestion, Question } from "@/types/game";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): LogicMatrixQuestion {
  return question as LogicMatrixQuestion;
}

export function isValidLogicMatrixConfiguration(question: LogicMatrixQuestion) {
  const pieceIds = question.pieces.map((piece) => piece.id);
  const pieceIdSet = new Set(pieceIds);
  const emptyCells = question.cells.filter((cell) => cell === null).length;
  return (
    question.pieces.length > 0 &&
    new Set(pieceIds).size === pieceIds.length &&
    question.pieces.every(
      (piece) =>
        Boolean(piece.id.trim()) && Boolean(piece.symbol.trim()) && Boolean(piece.label.trim()),
    ) &&
    question.cells.length === 9 &&
    emptyCells === 1 &&
    question.cells.every((cell) => cell === null || pieceIdSet.has(cell)) &&
    question.optionIds.length === 4 &&
    new Set(question.optionIds).size === question.optionIds.length &&
    question.optionIds.every((optionId) => pieceIdSet.has(optionId)) &&
    pieceIdSet.has(question.correctOptionId) &&
    question.optionIds.includes(question.correctOptionId)
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const logicQuestion = asQuestion(question);
  return (
    typeof answer === "string" &&
    isValidLogicMatrixConfiguration(logicQuestion) &&
    answer === logicQuestion.correctOptionId
  );
}

export function evaluateLogicMatrix({
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
  questionType: "logic-matrix",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateLogicMatrix,
} as const satisfies QuestionScoring;
