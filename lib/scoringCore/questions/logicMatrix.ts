import type { AnswerValue, LogicMatrixQuestion, Question } from "@/types/game";
import { calculateQuestionScore, CHOICE_PENALTY_RATIO } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

export type LogicMatrixPublicPayload = Pick<
  LogicMatrixQuestion,
  "pieces" | "cells" | "optionIds" | "showPieceLabels"
>;

function asQuestion(question: Question): LogicMatrixQuestion {
  return question as LogicMatrixQuestion;
}

export function isValidLogicMatrixConfiguration(question: LogicMatrixQuestion) {
  if (
    !isValidLogicMatrixPublicPayload({
      pieces: question.pieces,
      cells: question.cells,
      optionIds: question.optionIds,
      showPieceLabels: question.showPieceLabels,
    })
  ) {
    return false;
  }
  const pieceIds = question.pieces.map((piece) => piece.id);
  const pieceIdSet = new Set(pieceIds);
  return (
    pieceIdSet.has(question.correctOptionId) &&
    question.optionIds.includes(question.correctOptionId)
  );
}

export function isValidLogicMatrixPublicPayload(value: unknown): value is LogicMatrixPublicPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (
    !Array.isArray(payload.pieces) ||
    !Array.isArray(payload.cells) ||
    !Array.isArray(payload.optionIds) ||
    !Object.keys(payload).every((key) =>
      ["pieces", "cells", "optionIds", "showPieceLabels"].includes(key),
    )
  ) {
    return false;
  }

  const pieces = payload.pieces;
  const pieceIds = pieces.map((piece) =>
    piece && typeof piece === "object" && !Array.isArray(piece)
      ? (piece as Record<string, unknown>).id
      : undefined,
  );
  const pieceIdSet = new Set(pieceIds.filter((id): id is string => typeof id === "string"));
  const validPieces =
    pieces.length >= 4 &&
    pieces.length <= 20 &&
    pieces.every((piece) => {
      if (!piece || typeof piece !== "object" || Array.isArray(piece)) return false;
      const value = piece as Record<string, unknown>;
      return (
        Object.keys(value).every((key) => ["id", "symbol", "label"].includes(key)) &&
        typeof value.id === "string" &&
        value.id.trim().length > 0 &&
        value.id.length <= 120 &&
        typeof value.symbol === "string" &&
        value.symbol.trim().length > 0 &&
        value.symbol.length <= 120 &&
        typeof value.label === "string" &&
        value.label.trim().length > 0 &&
        value.label.length <= 500
      );
    }) &&
    pieceIdSet.size === pieces.length;
  const validCells =
    payload.cells.length === 9 &&
    payload.cells.filter((cell) => cell === null).length === 1 &&
    payload.cells.every(
      (cell) => cell === null || (typeof cell === "string" && pieceIdSet.has(cell)),
    );
  const validOptions =
    payload.optionIds.length === 4 &&
    payload.optionIds.every(
      (optionId) => typeof optionId === "string" && pieceIdSet.has(optionId),
    ) &&
    new Set(payload.optionIds).size === payload.optionIds.length;
  const validLabels =
    payload.showPieceLabels === undefined ||
    payload.showPieceLabels === null ||
    typeof payload.showPieceLabels === "boolean";
  return validPieces && validCells && validOptions && validLabels;
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
    points: calculateQuestionScore(question, correct, timeUsed, {
      incorrectPenaltyRatio: CHOICE_PENALTY_RATIO,
    }),
  };
}

export const scoring = {
  questionType: "logic-matrix",
  policy: "binary-speed",
  isAnswer: (answer) => typeof answer === "string",
  isCorrect,
  evaluate: evaluateLogicMatrix,
} as const satisfies QuestionScoring;
