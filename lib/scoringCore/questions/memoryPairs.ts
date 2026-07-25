import type {
  AnswerResultDetails,
  AnswerValue,
  MemoryPairsAnswer,
  MemoryPairsQuestion,
  Question,
} from "@/types/game";
import {
  applyAttemptPenalty,
  calculateProportionalScore,
  calculateSpeedMultiplier,
} from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): MemoryPairsQuestion {
  return question as MemoryPairsQuestion;
}

export function isMemoryPairsAnswer(answer: AnswerValue | null): answer is MemoryPairsAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "attempts" in answer &&
    Array.isArray(answer.attempts) &&
    answer.attempts.every(
      (attempt) =>
        Array.isArray(attempt) &&
        attempt.length === 2 &&
        attempt.every((tileId) => typeof tileId === "string"),
    )
  );
}

export function isValidMemoryPairsConfiguration(question: MemoryPairsQuestion) {
  const { rows, columns } = question.grid;
  const capacity = rows * columns;
  const tileIds = question.tiles.map((tile) => tile.id);
  const pairCounts = question.tiles.reduce<Record<string, number>>((counts, tile) => {
    counts[tile.pairId] = (counts[tile.pairId] ?? 0) + 1;
    return counts;
  }, {});
  const totalPairs = Object.keys(pairCounts).length;

  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows > 0 &&
    columns > 0 &&
    capacity === question.tiles.length &&
    totalPairs >= 4 &&
    totalPairs <= 10 &&
    question.tiles.length === totalPairs * 2 &&
    new Set(tileIds).size === tileIds.length &&
    question.tiles.every(
      (tile) =>
        Boolean(tile.id.trim()) &&
        Boolean(tile.pairId.trim()) &&
        Boolean(tile.label.trim()) &&
        (tile.symbol === undefined || Boolean(tile.symbol.trim())),
    ) &&
    Object.values(pairCounts).every((count) => count === 2) &&
    (question.mismatchRevealDuration === undefined ||
      (Number.isFinite(question.mismatchRevealDuration) && question.mismatchRevealDuration > 0))
  );
}

export function calculateMemoryPairsMetrics(
  question: MemoryPairsQuestion,
  answer: MemoryPairsAnswer,
) {
  const tileById = new Map(question.tiles.map((tile) => [tile.id, tile]));
  const pairIds = new Set(question.tiles.map((tile) => tile.pairId));
  const validAttempts = answer.attempts.filter(([firstId, secondId]) => {
    const first = tileById.get(firstId);
    const second = tileById.get(secondId);
    return Boolean(first && second && firstId !== secondId);
  });
  const valid =
    isValidMemoryPairsConfiguration(question) && validAttempts.length === answer.attempts.length;
  const matchedPairIds = new Set(
    validAttempts.flatMap(([firstId, secondId]) => {
      const first = tileById.get(firstId);
      const second = tileById.get(secondId);
      return first && second && first.pairId === second.pairId ? [first.pairId] : [];
    }),
  );
  const incorrectAttempts = validAttempts.filter(([firstId, secondId]) => {
    const first = tileById.get(firstId);
    const second = tileById.get(secondId);
    return !first || !second || first.pairId !== second.pairId;
  }).length;

  return {
    valid,
    matchedPairs: valid ? matchedPairIds.size : 0,
    totalPairs: pairIds.size,
    incorrectAttempts: valid ? incorrectAttempts : 0,
    totalAttempts: valid ? validAttempts.length : 0,
  };
}

function isCorrect(question: Question, answer: AnswerValue) {
  if (!isMemoryPairsAnswer(answer)) return false;
  const metrics = calculateMemoryPairsMetrics(asQuestion(question), answer);
  return metrics.valid && metrics.matchedPairs === metrics.totalPairs;
}

function unansweredDetails(question: Question): AnswerResultDetails {
  const memoryQuestion = asQuestion(question);
  return {
    type: "memory-pairs",
    matchedPairs: 0,
    totalPairs: new Set(memoryQuestion.tiles.map((tile) => tile.pairId)).size,
    incorrectAttempts: 0,
    totalAttempts: 0,
  };
}

export function evaluateMemoryPairs({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const memoryQuestion = asQuestion(question);
  if (!isMemoryPairsAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMemoryPairsMetrics(memoryQuestion, answer);
  if (!metrics.valid || metrics.totalAttempts === 0) {
    return {
      isCorrect: false,
      status: answer.attempts.length === 0 ? "unanswered" : "incorrect",
      points: 0,
      details: { type: "memory-pairs", ...metrics },
    };
  }

  const partialScore = calculateProportionalScore(
    memoryQuestion.points,
    metrics.matchedPairs,
    metrics.totalPairs,
    calculateSpeedMultiplier(timeUsed, memoryQuestion.timeLimit),
  );
  const points = applyAttemptPenalty(
    partialScore,
    memoryQuestion.points,
    metrics.incorrectAttempts,
  );
  const correct = metrics.matchedPairs === metrics.totalPairs;

  return {
    isCorrect: correct,
    status: correct ? "correct" : metrics.matchedPairs > 0 ? "partial" : "incorrect",
    points,
    details: { type: "memory-pairs", ...metrics },
  };
}

export const scoring = {
  questionType: "memory-pairs",
  policy: "partial-items",
  preserveTimedOutPoints: true,
  isAnswer: isMemoryPairsAnswer,
  isCorrect,
  evaluate: evaluateMemoryPairs,
  unansweredDetails,
} as const satisfies QuestionScoring;
