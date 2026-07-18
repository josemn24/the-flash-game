import { normalizeAnswer } from "@/lib/normalizeAnswer";
import type {
  AnswerResult,
  AnswerResultDetails,
  AnswerStatus,
  AnswerValue,
  AssignAllImageLabelingQuestion,
  AnagramQuestion,
  ClassificationAnswer,
  ClassificationQuestion,
  EstimationQuestion,
  ErrorReconstructionAnswer,
  ErrorReconstructionQuestion,
  FlashMemoryAnswer,
  FlashMemoryQuestion,
  HeatMapAnswer,
  HeatMapQuestion,
  ImageLabelingAnswer,
  ImageLabelingQuestion,
  LogicCodeQuestion,
  LogicMatrixQuestion,
  MiniWordleAnswer,
  MiniWordleQuestion,
  MiniNonogramAnswer,
  MiniNonogramQuestion,
  MiniSudokuAnswer,
  MiniSudokuQuestion,
  SlidingPuzzleAnswer,
  SlidingPuzzleQuestion,
  TimeMazeAnswer,
  TimeMazeQuestion,
  MatchingAnswer,
  MatchingQuestion,
  ProgressiveCluesQuestion,
  Question,
  QuestionType,
  SimonSequenceAnswer,
  SimonSequenceQuestion,
} from "@/types/game";
import { isValidProgressiveImageConfiguration } from "@/lib/progressiveImage";
import {
  findShortestTimeMazePath,
  getTimeMazeExitIndex,
  isValidTimeMazePath,
} from "@/lib/timeMaze";
import {
  isValidMiniWordleWord,
  isValidMiniWordleConfiguration,
  MINI_WORDLE_MAX_ATTEMPTS,
  normalizeMiniWordleWord,
} from "@/lib/miniWordle";

export type EvaluationInput = {
  question: Question;
  answer: AnswerValue | null;
  timeUsed: number;
  timedOut?: boolean;
  submittedCodes?: string[];
  matchingIncorrectAttempts?: number;
  progressiveCluesRevealed?: number;
};

export type ScoringPolicyId =
  | "binary-speed"
  | "partial-items"
  | "attempt-penalty"
  | "proximity"
  | "clue-speed"
  | "spatial-proximity"
  | "image-labeling"
  | "error-location-correction";

export const QUESTION_SCORING_POLICY = {
  "multiple-choice": "binary-speed",
  "odd-one-out": "binary-speed",
  matching: "partial-items",
  "true-false": "binary-speed",
  "short-text": "binary-speed",
  "progressive-clues": "clue-speed",
  "progressive-image": "binary-speed",
  "heat-map": "spatial-proximity",
  "image-labeling": "image-labeling",
  ordering: "binary-speed",
  classification: "partial-items",
  "flash-memory": "partial-items",
  "simon-sequence": "binary-speed",
  "logic-matrix": "binary-speed",
  "mini-sudoku": "partial-items",
  "mini-nonogram": "partial-items",
  "time-maze": "binary-speed",
  "sliding-puzzle": "binary-speed",
  "error-reconstruction": "error-location-correction",
  anagram: "binary-speed",
  "mini-wordle": "attempt-penalty",
  "logic-code": "attempt-penalty",
  estimation: "proximity",
} as const satisfies Record<QuestionType, ScoringPolicyId>;

type InternalEvaluation = {
  isCorrect: boolean;
  status: AnswerStatus;
  points: number;
  details?: AnswerResultDetails;
};

type EvaluationContext = {
  question: Question;
  answer: AnswerValue;
  timeUsed: number;
  submittedCodes: string[];
  incorrectAttempts: number;
  revealedClues: number;
};

type StringRecordAnswer =
  ClassificationAnswer | MatchingAnswer | FlashMemoryAnswer | ImageLabelingAnswer;

function isRecordAnswer(answer: AnswerValue | null): answer is StringRecordAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    !("stepId" in answer) &&
    Object.values(answer).every((value) => typeof value === "string")
  );
}

export function isClassificationAnswer(answer: AnswerValue | null): answer is ClassificationAnswer {
  return isRecordAnswer(answer);
}

export function isMatchingAnswer(answer: AnswerValue | null): answer is MatchingAnswer {
  return isRecordAnswer(answer);
}

export function isFlashMemoryAnswer(answer: AnswerValue | null): answer is FlashMemoryAnswer {
  return isRecordAnswer(answer);
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

export function isTimeMazeAnswer(answer: AnswerValue | null): answer is TimeMazeAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "path" in answer &&
    Array.isArray(answer.path) &&
    answer.path.length > 0 &&
    answer.path.every((position) => Number.isInteger(position))
  );
}

export function isSimonSequenceAnswer(answer: AnswerValue | null): answer is SimonSequenceAnswer {
  return Array.isArray(answer) && answer.every((step) => typeof step === "string");
}

export function isHeatMapAnswer(answer: AnswerValue | null): answer is HeatMapAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "x" in answer &&
    "y" in answer &&
    typeof answer.x === "number" &&
    Number.isFinite(answer.x) &&
    typeof answer.y === "number" &&
    Number.isFinite(answer.y)
  );
}

export function isImageLabelingAnswer(answer: AnswerValue | null): answer is ImageLabelingAnswer {
  return isRecordAnswer(answer);
}

export function isErrorReconstructionAnswer(
  answer: AnswerValue | null,
): answer is ErrorReconstructionAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "stepId" in answer &&
    typeof answer.stepId === "string" &&
    ("correction" in answer
      ? answer.correction === undefined ||
        answer.correction === null ||
        typeof answer.correction === "string"
      : true)
  );
}

export function isMiniWordleAnswer(answer: AnswerValue | null): answer is MiniWordleAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "guesses" in answer &&
    Array.isArray(answer.guesses) &&
    answer.guesses.every((guess) => typeof guess === "string")
  );
}

export function calculateMiniWordleMetrics(question: MiniWordleQuestion, answer: MiniWordleAnswer) {
  const normalizedGuesses = answer.guesses.map(normalizeMiniWordleWord);
  const solution = normalizeMiniWordleWord(question.correctAnswer);
  const solutionIndex = normalizedGuesses.indexOf(solution);
  const valid =
    isValidMiniWordleConfiguration(question) &&
    normalizedGuesses.length > 0 &&
    normalizedGuesses.length <= MINI_WORDLE_MAX_ATTEMPTS &&
    answer.guesses.every(isValidMiniWordleWord) &&
    (solutionIndex === -1 || solutionIndex === normalizedGuesses.length - 1);
  const solved = valid && normalizedGuesses.at(-1) === solution;
  const incorrectAttempts = solved ? normalizedGuesses.length - 1 : normalizedGuesses.length;
  return {
    valid,
    solved,
    attemptsUsed: valid ? normalizedGuesses.length : 0,
    incorrectAttempts: valid ? incorrectAttempts : 0,
  };
}

export function isValidAnagramConfiguration(question: AnagramQuestion) {
  const tileIds = question.tiles.map((tile) => tile.id);
  const solutionLetters = Array.from(question.correctAnswer.trim());
  const tileLetters = question.tiles.map((tile) => tile.value);
  const countLetters = (letters: string[]) =>
    [...letters].sort((left, right) => left.localeCompare(right, "es")).join("");
  return (
    question.tiles.length >= 3 &&
    question.tiles.length <= 10 &&
    Boolean(question.correctAnswer.trim()) &&
    !/\s/.test(question.correctAnswer) &&
    solutionLetters.length === question.tiles.length &&
    new Set(tileIds).size === tileIds.length &&
    question.tiles.every(
      (tile) =>
        Boolean(tile.id.trim()) &&
        Array.from(tile.value).length === 1 &&
        Boolean(tile.value.trim()),
    ) &&
    countLetters(solutionLetters) === countLetters(tileLetters) &&
    tileLetters.join("") !== question.correctAnswer
  );
}

function clampTime(timeUsed: number, timeLimit: number) {
  const safeLimit = Math.max(0, timeLimit);
  return Math.min(Math.max(timeUsed, 0), safeLimit);
}

function calculateSpeedMultiplier(timeUsed: number, timeLimit: number) {
  if (timeLimit <= 0) return 0.5;
  return 1 - 0.5 * (clampTime(timeUsed, timeLimit) / timeLimit);
}

function calculateProportionalScore(
  points: number,
  correctItems: number,
  totalItems: number,
  speedMultiplier: number,
) {
  if (totalItems <= 0) return 0;
  return Math.round(points * (correctItems / totalItems) * speedMultiplier);
}

function applyAttemptPenalty(score: number, points: number, incorrectAttempts: number) {
  const penalty = Math.round(points * 0.1) * Math.max(0, incorrectAttempts);
  return Math.max(0, score - penalty);
}

export function calculateMatchingMetrics(question: MatchingQuestion, answer: MatchingAnswer) {
  const correctPairs = question.leftItems.filter(
    (item) => answer[item.id] === item.correctMatchId,
  ).length;
  return { correctPairs, totalPairs: question.leftItems.length };
}

export function isValidFlashMemoryConfiguration(question: FlashMemoryQuestion) {
  const { rows, columns } = question.grid;
  const capacity = rows * columns;
  const itemIds = question.items.map((item) => item.id);
  const positions = question.items.map((item) => item.correctPosition);
  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows > 0 &&
    columns > 0 &&
    Number.isFinite(question.revealDuration) &&
    question.revealDuration > 0 &&
    question.items.length === capacity &&
    new Set(itemIds).size === itemIds.length &&
    new Set(positions).size === positions.length &&
    question.items.every(
      (item) =>
        Boolean(item.id.trim()) &&
        Boolean(item.label.trim()) &&
        Number.isInteger(item.correctPosition) &&
        item.correctPosition >= 0 &&
        item.correctPosition < capacity,
    )
  );
}

export function calculateFlashMemoryMetrics(
  question: FlashMemoryQuestion,
  answer: FlashMemoryAnswer,
) {
  const capacity = question.grid.rows * question.grid.columns;
  const validPositions = new Set(Array.from({ length: capacity }, (_, index) => String(index)));
  const itemIds = new Set(question.items.map((item) => item.id));
  const entries = Object.entries(answer);
  const assignedItemIds = entries.map(([, itemId]) => itemId);
  const valid =
    isValidFlashMemoryConfiguration(question) &&
    entries.length <= capacity &&
    entries.every(([position, itemId]) => validPositions.has(position) && itemIds.has(itemId)) &&
    new Set(assignedItemIds).size === assignedItemIds.length;
  const correctPlacements = valid
    ? question.items.filter((item) => answer[String(item.correctPosition)] === item.id).length
    : 0;
  return {
    correctPlacements,
    totalPlacements: capacity,
    complete: entries.length === capacity,
    valid,
  };
}

export function isValidSimonSequenceConfiguration(question: SimonSequenceQuestion) {
  const padIds = question.pads.map((pad) => pad.id);
  const padIdSet = new Set(padIds);
  return (
    question.pads.length === 4 &&
    new Set(padIds).size === padIds.length &&
    question.pads.every((pad) => Boolean(pad.id.trim()) && Boolean(pad.label.trim())) &&
    question.sequence.length >= 4 &&
    question.sequence.length <= 6 &&
    question.sequence.every((step) => padIdSet.has(step))
  );
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

export function findSimonSequenceMismatch(sequence: string[], answer: SimonSequenceAnswer) {
  const limit = Math.max(sequence.length, answer.length);
  for (let index = 0; index < limit; index += 1) {
    if (sequence[index] !== answer[index]) return index;
  }
  return null;
}

function isNormalizedPoint(point: { x: number; y: number }) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function isValidImageLabelingConfiguration(question: ImageLabelingQuestion) {
  if (
    !question.surface.src.trim() ||
    !question.surface.alt.trim() ||
    !Number.isFinite(question.surface.width) ||
    question.surface.width <= 0 ||
    !Number.isFinite(question.surface.height) ||
    question.surface.height <= 0
  ) {
    return false;
  }

  if (question.task === "assign-all") {
    const anchorIds = question.anchors.map((anchor) => anchor.id);
    const labelIds = question.labels.map((label) => label.id);
    const labelIdSet = new Set(labelIds);
    return (
      question.anchors.length > 0 &&
      question.labels.length >= question.anchors.length &&
      new Set(anchorIds).size === anchorIds.length &&
      new Set(labelIds).size === labelIds.length &&
      question.anchors.every(
        (anchor) =>
          Boolean(anchor.id.trim()) &&
          isNormalizedPoint(anchor.point) &&
          labelIdSet.has(anchor.correctLabelId),
      ) &&
      question.labels.every((label) => Boolean(label.id.trim()) && Boolean(label.label.trim()))
    );
  }

  if (!isNormalizedPoint(question.target) || !question.response.correctAnswer.trim()) return false;
  if (question.response.kind === "choice") {
    const normalizedOptions = question.response.options.map(normalizeAnswer);
    return (
      question.response.options.length >= 2 &&
      question.response.options.every((option) => Boolean(option.trim())) &&
      new Set(normalizedOptions).size === normalizedOptions.length &&
      normalizedOptions.includes(normalizeAnswer(question.response.correctAnswer))
    );
  }
  if (question.response.acceptedAnswers === undefined) return true;
  const normalizedAnswers = question.response.acceptedAnswers.map(normalizeAnswer);
  return (
    question.response.acceptedAnswers.length > 0 &&
    question.response.acceptedAnswers.every((answer) => Boolean(answer.trim())) &&
    new Set(normalizedAnswers).size === normalizedAnswers.length &&
    normalizedAnswers.includes(normalizeAnswer(question.response.correctAnswer))
  );
}

export function calculateImageLabelingMetrics(
  question: AssignAllImageLabelingQuestion,
  answer: ImageLabelingAnswer,
) {
  const anchorIds = new Set(question.anchors.map((anchor) => anchor.id));
  const labelIds = new Set(question.labels.map((label) => label.id));
  const entries = Object.entries(answer);
  const assignedLabels = entries.map(([, labelId]) => labelId);
  const valid =
    isValidImageLabelingConfiguration(question) &&
    entries.length === question.anchors.length &&
    entries.every(([anchorId, labelId]) => anchorIds.has(anchorId) && labelIds.has(labelId)) &&
    new Set(assignedLabels).size === assignedLabels.length;
  const correctLabels = valid
    ? question.anchors.filter((anchor) => answer[anchor.id] === anchor.correctLabelId).length
    : 0;
  return { correctLabels, totalLabels: question.anchors.length, valid };
}

export function isValidErrorReconstructionConfiguration(question: ErrorReconstructionQuestion) {
  const stepIds = question.steps.map((step) => step.id);
  if (
    question.steps.length < 3 ||
    question.steps.length > 7 ||
    new Set(stepIds).size !== stepIds.length ||
    !question.steps.every((step) => Boolean(step.id.trim()) && Boolean(step.text.trim())) ||
    !stepIds.includes(question.firstErrorStepId)
  ) {
    return false;
  }

  if (!question.correction) return true;
  const normalizedOptions = question.correction.options.map(normalizeAnswer);
  return (
    question.correction.options.length >= 2 &&
    question.correction.options.length <= 4 &&
    question.correction.options.every((option) => Boolean(option.trim())) &&
    new Set(normalizedOptions).size === normalizedOptions.length &&
    Boolean(question.correction.correctAnswer.trim()) &&
    normalizedOptions.includes(normalizeAnswer(question.correction.correctAnswer))
  );
}

export function calculateErrorReconstructionMetrics(
  question: ErrorReconstructionQuestion,
  answer: ErrorReconstructionAnswer,
) {
  const valid = isValidErrorReconstructionConfiguration(question);
  const selectedStepId = answer.stepId;
  const locationCorrect = valid && selectedStepId === question.firstErrorStepId;
  const correctionRequired = Boolean(question.correction);
  const correctionCorrect =
    locationCorrect &&
    (!question.correction ||
      (typeof answer.correction === "string" &&
        normalizeAnswer(answer.correction) === normalizeAnswer(question.correction.correctAnswer)));
  return { selectedStepId, locationCorrect, correctionRequired, correctionCorrect, valid };
}

export function isAnswerCorrect(question: Question, answer: AnswerValue): boolean {
  switch (question.type) {
    case "progressive-image": {
      if (typeof answer !== "string" || !isValidProgressiveImageConfiguration(question)) {
        return false;
      }
      const normalizedAnswer = normalizeAnswer(answer);
      return (question.acceptedAnswers ?? [question.correctAnswer]).some(
        (candidate) => normalizeAnswer(candidate) === normalizedAnswer,
      );
    }
    case "mini-wordle":
      return isMiniWordleAnswer(answer) && calculateMiniWordleMetrics(question, answer).solved;
    case "anagram":
      return (
        typeof answer === "string" &&
        isValidAnagramConfiguration(question) &&
        normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer)
      );
    case "error-reconstruction":
      return (
        isErrorReconstructionAnswer(answer) &&
        calculateErrorReconstructionMetrics(question, answer).correctionCorrect
      );
    case "heat-map":
      return isHeatMapAnswer(answer) && calculateHeatMapMetrics(question, answer).accuracy === 1;
    case "image-labeling":
      if (!isValidImageLabelingConfiguration(question)) return false;
      if (question.task === "assign-all") {
        if (!isImageLabelingAnswer(answer)) return false;
        const labelMetrics = calculateImageLabelingMetrics(question, answer);
        return labelMetrics.valid && labelMetrics.correctLabels === labelMetrics.totalLabels;
      }
      if (typeof answer !== "string") return false;
      const accepted =
        question.response.kind === "text"
          ? (question.response.acceptedAnswers ?? [question.response.correctAnswer])
          : [question.response.correctAnswer];
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(answer));
    case "estimation":
      return typeof answer === "number" && answer === question.correctAnswer;
    case "classification":
      return (
        isClassificationAnswer(answer) &&
        question.items.every((item) => answer[item.label] === item.correctCategory)
      );
    case "matching":
      return (
        isMatchingAnswer(answer) &&
        calculateMatchingMetrics(question, answer).correctPairs === question.leftItems.length
      );
    case "flash-memory": {
      if (!isFlashMemoryAnswer(answer)) return false;
      const metrics = calculateFlashMemoryMetrics(question, answer);
      return (
        metrics.valid && metrics.complete && metrics.correctPlacements === question.items.length
      );
    }
    case "simon-sequence":
      return (
        isSimonSequenceAnswer(answer) &&
        isValidSimonSequenceConfiguration(question) &&
        answer.length === question.sequence.length &&
        findSimonSequenceMismatch(question.sequence, answer) === null
      );
    case "logic-matrix":
      return (
        typeof answer === "string" &&
        isValidLogicMatrixConfiguration(question) &&
        answer === question.correctOptionId
      );
    case "mini-sudoku": {
      if (!isMiniSudokuAnswer(answer)) return false;
      const metrics = calculateMiniSudokuMetrics(question, answer);
      return metrics.valid && metrics.complete && metrics.correctCells === metrics.totalCells;
    }
    case "mini-nonogram": {
      if (!isMiniNonogramAnswer(answer)) return false;
      return calculateMiniNonogramMetrics(question, answer).exact;
    }
    case "time-maze":
      return (
        isTimeMazeAnswer(answer) &&
        isValidTimeMazePath(question, answer.path) &&
        answer.path.at(-1) === getTimeMazeExitIndex(question)
      );
    case "sliding-puzzle":
      return (
        isSlidingPuzzleAnswer(answer) &&
        isValidSlidingPuzzleConfiguration(question) &&
        answer.tiles.every((tile, index) => tile === question.solution[index])
      );
    case "ordering":
      return (
        Array.isArray(answer) &&
        answer.length === question.correctOrder.length &&
        answer.every((item, index) => item === question.correctOrder[index])
      );
    case "true-false":
      return answer === question.correctAnswer;
    default: {
      if (typeof answer !== "string") return false;
      const accepted =
        question.type === "short-text" || question.type === "progressive-clues"
          ? (question.acceptedAnswers ?? [question.correctAnswer])
          : [question.correctAnswer];
      const normalizedAnswer = normalizeAnswer(answer);
      return accepted.some((candidate) => normalizeAnswer(candidate) === normalizedAnswer);
    }
  }
}

function clampNormalizedCoordinate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateHeatMapMetrics(question: HeatMapQuestion, answer: HeatMapAnswer) {
  const selectedPoint = {
    x: clampNormalizedCoordinate(answer.x),
    y: clampNormalizedCoordinate(answer.y),
  };
  const targetPoint = {
    x: clampNormalizedCoordinate(question.target.x),
    y: clampNormalizedCoordinate(question.target.y),
  };
  const width = Math.max(1, safeNonNegative(Math.abs(question.surface.width)));
  const height = Math.max(1, safeNonNegative(Math.abs(question.surface.height)));
  const shortSide = Math.min(width, height);
  const distance = Math.hypot(
    (selectedPoint.x - targetPoint.x) * (width / shortSide),
    (selectedPoint.y - targetPoint.y) * (height / shortSide),
  );
  const fullCreditRadius = safeNonNegative(question.fullCreditRadius);
  const toleranceRadius = Math.max(fullCreditRadius, safeNonNegative(question.toleranceRadius));
  const accuracy =
    distance <= fullCreditRadius
      ? 1
      : toleranceRadius <= fullCreditRadius || distance >= toleranceRadius
        ? 0
        : 1 - (distance - fullCreditRadius) / (toleranceRadius - fullCreditRadius);

  return { selectedPoint, targetPoint, distance, accuracy };
}

function clampRevealedClues(revealedClues: number, totalClues: number) {
  if (totalClues <= 0) return 0;
  const safeValue = Number.isFinite(revealedClues) ? Math.trunc(revealedClues) : 1;
  return Math.min(Math.max(safeValue, 1), totalClues);
}

export function calculateProgressiveCluesMetrics(
  question: ProgressiveCluesQuestion,
  revealedClues: number,
) {
  const totalClues = question.clues.length;
  const safeRevealedClues = clampRevealedClues(revealedClues, totalClues);
  const additionalClues = Math.max(0, safeRevealedClues - 1);
  const availablePoints = Math.max(0, question.points - question.cluePenalty * additionalClues);
  return { revealedClues: safeRevealedClues, totalClues, availablePoints };
}

export function calculateEstimationMetrics(question: EstimationQuestion, answer: number) {
  const difference = Math.abs(answer - question.correctAnswer);
  const proximity =
    question.tolerance <= 0
      ? Number(difference === 0)
      : Math.min(1, Math.max(0, 1 - difference / question.tolerance));
  return { difference, proximity };
}

export function calculateQuestionScore(question: Question, correct: boolean, timeUsed: number) {
  if (correct) {
    const score = Math.round(
      question.points * calculateSpeedMultiplier(timeUsed, question.timeLimit),
    );
    return Math.max(score, Math.ceil(question.points * 0.5));
  }

  if (question.type === "true-false") return -Math.round(question.points * 0.4);
  if (
    question.type === "multiple-choice" ||
    question.type === "odd-one-out" ||
    question.type === "ordering" ||
    question.type === "logic-matrix"
  ) {
    return -Math.round(question.points * 0.2);
  }
  return 0;
}

function evaluateBinarySpeed({
  question,
  answer,
  timeUsed,
}: EvaluationContext): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateQuestionScore(question, isCorrect, timeUsed),
  };
}

function evaluateClassification(
  question: ClassificationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isClassificationAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const correctItems = question.items.filter(
    (item) => answer[item.label] === item.correctCategory,
  ).length;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      correctItems,
      question.items.length,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
  };
}

function evaluateMatching(
  question: MatchingQuestion,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (!isMatchingAnswer(answer)) {
    return { isCorrect, status: "incorrect", points: 0 };
  }

  const metrics = calculateMatchingMetrics(question, answer);
  const partialScore = calculateProportionalScore(
    question.points,
    metrics.correctPairs,
    metrics.totalPairs,
    calculateSpeedMultiplier(timeUsed, question.timeLimit),
  );
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctPairs > 0 ? "partial" : "incorrect",
    points: applyAttemptPenalty(partialScore, question.points, incorrectAttempts),
    details: { type: "matching", ...metrics, incorrectAttempts },
  };
}

function evaluateFlashMemory(
  question: FlashMemoryQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isFlashMemoryAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateFlashMemoryMetrics(question, answer);
  const isCorrect = metrics.valid && metrics.correctPlacements === metrics.totalPlacements;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctPlacements > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      metrics.correctPlacements,
      metrics.totalPlacements,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "flash-memory",
      correctPlacements: metrics.correctPlacements,
      totalPlacements: metrics.totalPlacements,
    },
  };
}

function evaluateMiniSudoku(
  question: MiniSudokuQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isMiniSudokuAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniSudokuMetrics(question, answer);
  const isCorrect =
    metrics.valid && metrics.complete && metrics.correctCells === metrics.totalCells;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctCells > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      metrics.correctCells,
      metrics.totalCells,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "mini-sudoku",
      correctCells: metrics.correctCells,
      totalCells: metrics.totalCells,
    },
  };
}

function evaluateMiniNonogram(
  question: MiniNonogramQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isMiniNonogramAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniNonogramMetrics(question, answer);
  const netFilled = Math.max(0, metrics.correctFilled - metrics.incorrectFilled);
  return {
    isCorrect: metrics.exact,
    status: metrics.exact ? "correct" : netFilled > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      netFilled,
      metrics.totalFilled,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "mini-nonogram",
      correctFilled: metrics.correctFilled,
      incorrectFilled: metrics.incorrectFilled,
      totalFilled: metrics.totalFilled,
    },
  };
}

function evaluateSimonSequence(
  question: SimonSequenceQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const submittedSteps = isSimonSequenceAnswer(answer) ? answer : [];
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0,
    details: {
      type: "simon-sequence",
      submittedSteps,
      firstMismatchIndex: findSimonSequenceMismatch(question.sequence, submittedSteps),
    },
  };
}

function evaluateSlidingPuzzle(
  question: SlidingPuzzleQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const submittedAnswer = isSlidingPuzzleAnswer(answer) ? answer : null;
  const isCorrect = isAnswerCorrect(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0,
    details: { type: "sliding-puzzle", moves: submittedAnswer?.moves ?? 0 },
  };
}

function evaluateTimeMaze(
  question: TimeMazeQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const submittedAnswer = isTimeMazeAnswer(answer) ? answer : null;
  const validPath = submittedAnswer ? isValidTimeMazePath(question, submittedAnswer.path) : false;
  const reachedExit = validPath && submittedAnswer?.path.at(-1) === getTimeMazeExitIndex(question);
  const optimalPath = findShortestTimeMazePath(question);
  const moves = validPath && submittedAnswer ? submittedAnswer.path.length - 1 : 0;
  const optimalMoves = optimalPath ? optimalPath.length - 1 : 0;

  return {
    isCorrect: reachedExit,
    status: reachedExit ? "correct" : "incorrect",
    points: reachedExit ? calculateQuestionScore(question, true, timeUsed) : 0,
    details: { type: "time-maze", moves, optimalMoves, reachedExit },
  };
}

function evaluateImageLabeling(
  question: ImageLabelingQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isValidImageLabelingConfiguration(question)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  if (question.task === "identify-one") {
    if (typeof answer !== "string") {
      return { isCorrect: false, status: "incorrect", points: 0 };
    }
    const isCorrect = isAnswerCorrect(question, answer);
    return {
      isCorrect,
      status: isCorrect ? "correct" : "incorrect",
      points: isCorrect
        ? calculateQuestionScore(question, true, timeUsed)
        : question.response.kind === "choice"
          ? -Math.round(question.points * 0.2)
          : 0,
      details: {
        type: "image-labeling",
        task: "identify-one",
        responseKind: question.response.kind,
      },
    };
  }

  if (!isImageLabelingAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateImageLabelingMetrics(question, answer);
  if (!metrics.valid) {
    return {
      isCorrect: false,
      status: "incorrect",
      points: 0,
      details: {
        type: "image-labeling",
        task: "assign-all",
        correctLabels: 0,
        totalLabels: metrics.totalLabels,
      },
    };
  }

  const isCorrect = metrics.correctLabels === metrics.totalLabels;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.correctLabels > 0 ? "partial" : "incorrect",
    points: calculateProportionalScore(
      question.points,
      metrics.correctLabels,
      metrics.totalLabels,
      calculateSpeedMultiplier(timeUsed, question.timeLimit),
    ),
    details: {
      type: "image-labeling",
      task: "assign-all",
      correctLabels: metrics.correctLabels,
      totalLabels: metrics.totalLabels,
    },
  };
}

function evaluateEstimation(
  question: EstimationQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  if (typeof answer !== "number") {
    return { isCorrect, status: "partial", points: 0 };
  }

  const metrics = calculateEstimationMetrics(question, answer);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "partial",
    points: Math.max(
      0,
      Math.round(
        question.points *
          metrics.proximity *
          calculateSpeedMultiplier(timeUsed, question.timeLimit),
      ),
    ),
    details: { type: "estimation", ...metrics },
  };
}

function evaluateLogicCode(
  question: LogicCodeQuestion,
  answer: AnswerValue,
  timeUsed: number,
  submittedCodes: string[],
  incorrectAttempts: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const speedScore = isCorrect ? calculateQuestionScore(question, true, timeUsed) : 0;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: applyAttemptPenalty(speedScore, question.points, incorrectAttempts),
    details: { type: "logic-code", submittedCodes, incorrectAttempts },
  };
}

function evaluateProgressiveClues(
  question: ProgressiveCluesQuestion,
  answer: AnswerValue,
  timeUsed: number,
  revealedClues: number,
): InternalEvaluation {
  const isCorrect = isAnswerCorrect(question, answer);
  const metrics = calculateProgressiveCluesMetrics(question, revealedClues);
  return {
    isCorrect,
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect
      ? Math.round(metrics.availablePoints * calculateSpeedMultiplier(timeUsed, question.timeLimit))
      : 0,
    details: { type: "progressive-clues", ...metrics },
  };
}

function evaluateHeatMap(
  question: HeatMapQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isHeatMapAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateHeatMapMetrics(question, answer);
  const isCorrect = metrics.accuracy === 1;
  return {
    isCorrect,
    status: isCorrect ? "correct" : metrics.accuracy > 0 ? "partial" : "incorrect",
    points: Math.max(
      0,
      Math.round(
        question.points * metrics.accuracy * calculateSpeedMultiplier(timeUsed, question.timeLimit),
      ),
    ),
    details: {
      type: "heat-map",
      ...metrics,
    },
  };
}

function evaluateErrorReconstruction(
  question: ErrorReconstructionQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isErrorReconstructionAnswer(answer)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateErrorReconstructionMetrics(question, answer);
  if (!metrics.valid || !metrics.locationCorrect) {
    return {
      isCorrect: false,
      status: "incorrect",
      points: 0,
      details: { type: "error-reconstruction", ...metrics },
    };
  }

  const speedMultiplier = calculateSpeedMultiplier(timeUsed, question.timeLimit);
  const fraction = question.correction ? (metrics.correctionCorrect ? 1 : 0.6) : 1;
  const isCorrect = metrics.correctionCorrect;
  return {
    isCorrect,
    status: isCorrect ? "correct" : "partial",
    points: Math.round(question.points * fraction * speedMultiplier),
    details: { type: "error-reconstruction", ...metrics },
  };
}

function evaluateMiniWordle(
  question: MiniWordleQuestion,
  answer: AnswerValue,
  timeUsed: number,
): InternalEvaluation {
  if (!isMiniWordleAnswer(answer) || !isValidMiniWordleConfiguration(question)) {
    return { isCorrect: false, status: "incorrect", points: 0 };
  }

  const metrics = calculateMiniWordleMetrics(question, answer);
  const details = {
    type: "mini-wordle" as const,
    attemptsUsed: metrics.attemptsUsed,
    incorrectAttempts: metrics.incorrectAttempts,
    solved: metrics.solved,
  };

  if (!metrics.solved) {
    return { isCorrect: false, status: "incorrect", points: 0, details };
  }

  const speedScore = Math.round(
    question.points * calculateSpeedMultiplier(timeUsed, question.timeLimit),
  );
  return {
    isCorrect: true,
    status: "correct",
    points: applyAttemptPenalty(speedScore, question.points, metrics.incorrectAttempts),
    details,
  };
}

function evaluateByPolicy(context: EvaluationContext): InternalEvaluation {
  const { question, answer, timeUsed, submittedCodes, incorrectAttempts, revealedClues } = context;

  switch (QUESTION_SCORING_POLICY[question.type]) {
    case "binary-speed":
      if (question.type === "simon-sequence") {
        return evaluateSimonSequence(question, answer, timeUsed);
      }
      if (question.type === "sliding-puzzle") {
        return evaluateSlidingPuzzle(question, answer, timeUsed);
      }
      if (question.type === "time-maze") {
        return evaluateTimeMaze(question, answer, timeUsed);
      }
      return evaluateBinarySpeed(context);
    case "partial-items":
      if (question.type === "classification") {
        return evaluateClassification(question, answer, timeUsed);
      }
      if (question.type === "matching") {
        return evaluateMatching(question, answer, timeUsed, incorrectAttempts);
      }
      if (question.type === "flash-memory") {
        return evaluateFlashMemory(question, answer, timeUsed);
      }
      if (question.type === "mini-sudoku") {
        return evaluateMiniSudoku(question, answer, timeUsed);
      }
      if (question.type === "mini-nonogram") {
        return evaluateMiniNonogram(question, answer, timeUsed);
      }
      throw new Error(`Unsupported partial-items question: ${question.type}`);
    case "attempt-penalty": {
      if (question.type === "logic-code") {
        return evaluateLogicCode(question, answer, timeUsed, submittedCodes, incorrectAttempts);
      }
      if (question.type === "mini-wordle") {
        return evaluateMiniWordle(question, answer, timeUsed);
      }
      throw new Error(`Unsupported attempt-penalty question: ${question.type}`);
    }
    case "proximity": {
      if (question.type !== "estimation") {
        throw new Error(`Unsupported proximity question: ${question.type}`);
      }
      return evaluateEstimation(question, answer, timeUsed);
    }
    case "clue-speed": {
      if (question.type !== "progressive-clues") {
        throw new Error(`Unsupported clue-speed question: ${question.type}`);
      }
      return evaluateProgressiveClues(question, answer, timeUsed, revealedClues);
    }
    case "spatial-proximity": {
      if (question.type !== "heat-map") {
        throw new Error(`Unsupported spatial-proximity question: ${question.type}`);
      }
      return evaluateHeatMap(question, answer, timeUsed);
    }
    case "image-labeling": {
      if (question.type !== "image-labeling") {
        throw new Error(`Unsupported image-labeling question: ${question.type}`);
      }
      return evaluateImageLabeling(question, answer, timeUsed);
    }
    case "error-location-correction": {
      if (question.type !== "error-reconstruction") {
        throw new Error(`Unsupported error-location-correction question: ${question.type}`);
      }
      return evaluateErrorReconstruction(question, answer, timeUsed);
    }
  }
}

export function calculateAnswerScore(
  question: Question,
  answer: AnswerValue,
  timeUsed: number,
  incorrectAttempts = 0,
  revealedClues = 1,
) {
  return evaluateByPolicy({
    question,
    answer,
    timeUsed: clampTime(timeUsed, question.timeLimit),
    submittedCodes: [],
    incorrectAttempts,
    revealedClues,
  }).points;
}

export function evaluateAnswer({
  question,
  answer,
  timeUsed,
  timedOut = false,
  submittedCodes = [],
  matchingIncorrectAttempts = 0,
  progressiveCluesRevealed = 1,
}: EvaluationInput): AnswerResult {
  const safeTime = clampTime(timeUsed, question.timeLimit);
  if (answer === null) {
    return {
      questionId: question.id,
      answer,
      status: "unanswered",
      isCorrect: false,
      points: 0,
      timeUsed: safeTime,
      ...(question.type === "logic-code"
        ? {
            details: {
              type: "logic-code" as const,
              submittedCodes,
              incorrectAttempts: submittedCodes.length,
            },
          }
        : question.type === "progressive-clues"
          ? {
              details: {
                type: "progressive-clues" as const,
                ...calculateProgressiveCluesMetrics(question, progressiveCluesRevealed),
              },
            }
          : question.type === "simon-sequence"
            ? {
                details: {
                  type: "simon-sequence" as const,
                  submittedSteps: [],
                  firstMismatchIndex: null,
                },
              }
            : question.type === "error-reconstruction"
              ? {
                  details: {
                    type: "error-reconstruction" as const,
                    selectedStepId: null,
                    locationCorrect: false,
                    correctionRequired: Boolean(question.correction),
                    correctionCorrect: false,
                  },
                }
              : question.type === "mini-wordle"
                ? {
                    details: {
                      type: "mini-wordle" as const,
                      attemptsUsed: 0,
                      incorrectAttempts: 0,
                      solved: false,
                    },
                  }
                : question.type === "time-maze"
                  ? {
                      details: {
                        type: "time-maze" as const,
                        moves: 0,
                        optimalMoves: (findShortestTimeMazePath(question)?.length ?? 1) - 1,
                        reachedExit: false,
                      },
                    }
                  : {}),
    };
  }

  const isCorrect = isAnswerCorrect(question, answer);
  const incorrectAttempts =
    question.type === "logic-code" ? Math.max(0, submittedCodes.length - (isCorrect ? 1 : 0)) : 0;
  const evaluation = evaluateByPolicy({
    question,
    answer,
    timeUsed: safeTime,
    submittedCodes,
    incorrectAttempts: question.type === "matching" ? matchingIncorrectAttempts : incorrectAttempts,
    revealedClues: question.type === "progressive-clues" ? progressiveCluesRevealed : 1,
  });

  const matchingWithoutProgress =
    timedOut && evaluation.details?.type === "matching" && evaluation.details.correctPairs === 0;
  const discardedSpatialDraft =
    timedOut && (question.type === "heat-map" || question.type === "image-labeling");
  const timedOutMiniWordle = timedOut && question.type === "mini-wordle";
  const timedOutMaze = timedOut && question.type === "time-maze";

  return {
    questionId: question.id,
    answer,
    ...evaluation,
    status:
      matchingWithoutProgress || discardedSpatialDraft || timedOutMiniWordle || timedOutMaze
        ? "unanswered"
        : evaluation.status,
    points:
      timedOut &&
      question.type !== "matching" &&
      question.type !== "flash-memory" &&
      question.type !== "mini-sudoku" &&
      question.type !== "mini-nonogram" &&
      question.type !== "error-reconstruction"
        ? 0
        : evaluation.points,
    timeUsed: safeTime,
  };
}

export function calculateTotalScore(scores: number[]) {
  return Math.max(
    0,
    scores.reduce((total, score) => total + score, 0),
  );
}
