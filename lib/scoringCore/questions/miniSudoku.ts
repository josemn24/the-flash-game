import type { AnswerValue, MiniSudokuAnswer, MiniSudokuQuestion, Question } from "@/types/game";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MiniSudokuQuestion {
  return question as MiniSudokuQuestion;
}

export function isMiniSudokuAnswer(answer: AnswerValue | null): answer is MiniSudokuAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    Object.entries(answer).every(
      ([index, value]) => Number.isInteger(Number(index)) && Number.isInteger(value),
    )
  );
}

function isValidMiniSudokuUnit(values: number[]) {
  return (
    values.length === 4 &&
    values.every((value) => Number.isInteger(value) && value >= 1 && value <= 4) &&
    new Set(values).size === 4
  );
}

export function isValidMiniSudokuConfiguration(question: MiniSudokuQuestion) {
  if (question.grid.length !== 16 || question.solution.length !== 16) return false;

  const blanks = question.grid.filter((value) => value === null).length;
  if (blanks < 3 || blanks > 4) return false;

  const solutionIsValid = Array.from({ length: 4 }, (_, groupIndex) => {
    const row = question.solution.slice(groupIndex * 4, groupIndex * 4 + 4);
    const column = Array.from(
      { length: 4 },
      (_, rowIndex) => question.solution[rowIndex * 4 + groupIndex],
    );
    const blockRow = Math.floor(groupIndex / 2) * 2;
    const blockColumn = (groupIndex % 2) * 2;
    const block = Array.from(
      { length: 4 },
      (_, offset) =>
        question.solution[(blockRow + Math.floor(offset / 2)) * 4 + blockColumn + (offset % 2)],
    );
    return (
      isValidMiniSudokuUnit(row) && isValidMiniSudokuUnit(column) && isValidMiniSudokuUnit(block)
    );
  }).every(Boolean);

  return (
    solutionIsValid &&
    question.grid.every(
      (value, index) =>
        value === null ||
        (Number.isInteger(value) && value >= 1 && value <= 4 && value === question.solution[index]),
    )
  );
}

export function calculateMiniSudokuMetrics(question: MiniSudokuQuestion, answer: MiniSudokuAnswer) {
  const blankIndexes = question.grid.flatMap((value, index) => (value === null ? [index] : []));
  const validIndexes = new Set(blankIndexes.map(String));
  const entries = Object.entries(answer);
  const valid =
    isValidMiniSudokuConfiguration(question) &&
    entries.length <= blankIndexes.length &&
    entries.every(
      ([index, value]) =>
        validIndexes.has(index) && Number.isInteger(value) && value >= 1 && value <= 4,
    );
  const correctCells = valid
    ? blankIndexes.filter((index) => answer[String(index)] === question.solution[index]).length
    : 0;
  return {
    correctCells,
    totalCells: blankIndexes.length,
    complete: entries.length === blankIndexes.length,
    valid,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isMiniSudokuAnswer(answer)) return false;
  const metrics = calculateMiniSudokuMetrics(asQuestion(question), answer);
  return metrics.valid && metrics.complete && metrics.correctCells === metrics.totalCells;
}

export function evaluateMiniSudoku({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const sudokuQuestion = asQuestion(question);
  if (!isMiniSudokuAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniSudokuMetrics(sudokuQuestion, answer);
  const correct = metrics.valid && metrics.complete && metrics.correctCells === metrics.totalCells;
  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.correctCells > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      sudokuQuestion.points,
      metrics.correctCells,
      metrics.totalCells,
      calculateSpeedMultiplier(timeUsed, sudokuQuestion.timeLimit),
    ),
    details: {
      type: "mini-sudoku",
      correctCells: metrics.correctCells,
      totalCells: metrics.totalCells,
    },
  };
}

export const scoring = {
  questionType: "mini-sudoku",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  timeoutAnswerSource: "draft",
  isAnswer: isMiniSudokuAnswer,
  isCorrect,
  evaluate: evaluateMiniSudoku,
} as const satisfies QuestionScoring;
