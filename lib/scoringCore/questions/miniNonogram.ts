import type { AnswerValue, MiniNonogramAnswer, MiniNonogramQuestion, Question } from "@/types/game";
import { calculateProportionalScore, calculateSpeedMultiplier } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MiniNonogramQuestion {
  return question as MiniNonogramQuestion;
}

export function isMiniNonogramAnswer(answer: AnswerValue | null): answer is MiniNonogramAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    Object.entries(answer).every(
      ([index, value]) => Number.isInteger(Number(index)) && value === true,
    )
  );
}

function deriveNonogramClues(values: boolean[]) {
  const clues: number[] = [];
  let runLength = 0;
  for (const value of values) {
    if (value) {
      runLength += 1;
    } else if (runLength > 0) {
      clues.push(runLength);
      runLength = 0;
    }
  }
  if (runLength > 0) clues.push(runLength);
  return clues;
}

function sameNumberList(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function isValidMiniNonogramConfiguration(question: MiniNonogramQuestion) {
  if (
    question.solution.length !== 25 ||
    question.rowClues.length !== 5 ||
    question.columnClues.length !== 5 ||
    !question.solution.every((value) => typeof value === "boolean")
  ) {
    return false;
  }

  const cluesAreValid = [...question.rowClues, ...question.columnClues].every((clues) =>
    clues.every((clue) => Number.isInteger(clue) && clue > 0),
  );
  if (!cluesAreValid) return false;

  return (
    question.rowClues.every((clues, row) =>
      sameNumberList(clues, deriveNonogramClues(question.solution.slice(row * 5, row * 5 + 5))),
    ) &&
    question.columnClues.every((clues, column) =>
      sameNumberList(
        clues,
        deriveNonogramClues(
          Array.from({ length: 5 }, (_, row) => question.solution[row * 5 + column]),
        ),
      ),
    )
  );
}

export function calculateMiniNonogramMetrics(
  question: MiniNonogramQuestion,
  answer: MiniNonogramAnswer,
) {
  const entries = Object.entries(answer);
  const validIndexes = new Set(Array.from({ length: 25 }, (_, index) => String(index)));
  const valid =
    isValidMiniNonogramConfiguration(question) &&
    entries.every(([index, value]) => validIndexes.has(index) && value === true);
  const filledIndexes = valid ? entries.map(([index]) => Number(index)) : [];
  const correctFilled = filledIndexes.filter((index) => question.solution[index]).length;
  const incorrectFilled = filledIndexes.length - correctFilled;
  const totalFilled = question.solution.filter(Boolean).length;
  const exact =
    valid &&
    filledIndexes.length === totalFilled &&
    question.solution.every((filled, index) => filled === filledIndexes.includes(index));
  return { correctFilled, incorrectFilled, totalFilled, exact, valid };
}

function isCorrect(question: Question, answer: AnswerValue) {
  return (
    isMiniNonogramAnswer(answer) && calculateMiniNonogramMetrics(asQuestion(question), answer).exact
  );
}

export function evaluateMiniNonogram({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const nonogramQuestion = asQuestion(question);
  if (!isMiniNonogramAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniNonogramMetrics(nonogramQuestion, answer);
  const netFilled = Math.max(0, metrics.correctFilled - metrics.incorrectFilled);
  return {
    isCorrect: metrics.exact,
    status: metrics.exact ? "correct" : netFilled > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      nonogramQuestion.points,
      netFilled,
      metrics.totalFilled,
      calculateSpeedMultiplier(timeUsed, nonogramQuestion.timeLimit),
    ),
    details: {
      type: "mini-nonogram",
      correctFilled: metrics.correctFilled,
      incorrectFilled: metrics.incorrectFilled,
      totalFilled: metrics.totalFilled,
    },
  };
}

export const scoring = {
  questionType: "mini-nonogram",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  timeoutAnswerSource: "draft",
  isAnswer: isMiniNonogramAnswer,
  isCorrect,
  evaluate: evaluateMiniNonogram,
} as const satisfies QuestionScoring;
