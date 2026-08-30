import type {
  AnswerValue,
  Question,
  SlidingPuzzleAnswer,
  SlidingPuzzleQuestion,
} from "@/types/game";
import { calculateQuestionScore } from "@/lib/scoringCore/shared";
import type {
  EvaluationContext,
  InternalEvaluation,
  QuestionScoring,
} from "@/lib/scoringCore/types";

function asQuestion(question: Question): SlidingPuzzleQuestion {
  return question as SlidingPuzzleQuestion;
}

export function isSlidingPuzzleAnswer(answer: AnswerValue | null): answer is SlidingPuzzleAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "tiles" in answer &&
    "moves" in answer &&
    Array.isArray(answer.tiles) &&
    answer.tiles.length === 9 &&
    answer.tiles.every(
      (tile) => tile === null || (Number.isInteger(tile) && tile >= 1 && tile <= 8),
    ) &&
    typeof answer.moves === "number" &&
    Number.isInteger(answer.moves) &&
    answer.moves >= 0
  );
}

function hasSlidingPuzzleTiles(tiles: Array<number | null>) {
  return (
    tiles.length === 9 &&
    tiles.filter((tile) => tile === null).length === 1 &&
    new Set(tiles.filter((tile): tile is number => tile !== null)).size === 8 &&
    tiles.every((tile) => tile === null || (Number.isInteger(tile) && tile >= 1 && tile <= 8))
  );
}

function slidingPuzzleParity(tiles: Array<number | null>) {
  const numberedTiles = tiles.filter((tile): tile is number => tile !== null);
  let inversions = 0;
  for (let left = 0; left < numberedTiles.length; left += 1) {
    for (let right = left + 1; right < numberedTiles.length; right += 1) {
      if (numberedTiles[left] > numberedTiles[right]) inversions += 1;
    }
  }
  return inversions % 2;
}

export function isValidSlidingPuzzleConfiguration(question: SlidingPuzzleQuestion) {
  return (
    hasSlidingPuzzleTiles(question.initialTiles) &&
    hasSlidingPuzzleTiles(question.solution) &&
    !question.initialTiles.every((tile, index) => tile === question.solution[index]) &&
    slidingPuzzleParity(question.initialTiles) === slidingPuzzleParity(question.solution)
  );
}

function isCorrect(question: Question, answer: AnswerValue) {
  const puzzleQuestion = asQuestion(question);
  return (
    isSlidingPuzzleAnswer(answer) &&
    isValidSlidingPuzzleConfiguration(puzzleQuestion) &&
    answer.tiles.every((tile, index) => tile === puzzleQuestion.solution[index])
  );
}

export function evaluateSlidingPuzzle({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const puzzleQuestion = asQuestion(question);
  const submittedAnswer = isSlidingPuzzleAnswer(answer) ? answer : null;
  const correct = isCorrect(question, answer);
  return {
    isCorrect: correct,
    status: correct ? "correct" : "incorrect",
    points: correct ? calculateQuestionScore(puzzleQuestion, true, timeUsed) : 0,
    details: { type: "sliding-puzzle", moves: submittedAnswer?.moves ?? 0 },
  };
}

export const scoring = {
  questionType: "sliding-puzzle",
  policy: "binary-speed",
  isAnswer: isSlidingPuzzleAnswer,
  isCorrect,
  evaluate: evaluateSlidingPuzzle,
} as const satisfies QuestionScoring;
