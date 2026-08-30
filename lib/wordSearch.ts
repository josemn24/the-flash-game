import type {
  AnswerValue,
  WordSearchAnswer,
  WordSearchQuestion,
  WordSearchTarget,
} from "@/types/game";

const MIN_GRID_SIZE = 6;
const MAX_GRID_SIZE = 10;
const MIN_TARGETS = 2;
const MAX_TARGETS = 8;
const SPANISH_LETTER = /^[A-ZÁÉÍÓÚÜÑ]$/u;
const SPANISH_WORD = /^[A-ZÁÉÍÓÚÜÑ]+$/u;

export function normalizeWordSearchText(value: string) {
  return value.trim().toLocaleUpperCase("es-ES").normalize("NFC");
}

function isCellInGrid(question: WordSearchQuestion, cell: number) {
  return Number.isInteger(cell) && cell >= 0 && cell < question.grid.rows * question.grid.columns;
}

export function getWordSearchPath(
  grid: WordSearchQuestion["grid"],
  startCell: number,
  endCell: number,
) {
  const capacity = grid.rows * grid.columns;
  if (
    !Number.isInteger(startCell) ||
    !Number.isInteger(endCell) ||
    startCell < 0 ||
    endCell < 0 ||
    startCell >= capacity ||
    endCell >= capacity ||
    startCell === endCell
  ) {
    return null;
  }

  const startRow = Math.floor(startCell / grid.columns);
  const startColumn = startCell % grid.columns;
  const endRow = Math.floor(endCell / grid.columns);
  const endColumn = endCell % grid.columns;
  const rowDistance = endRow - startRow;
  const columnDistance = endColumn - startColumn;
  if (
    rowDistance !== 0 &&
    columnDistance !== 0 &&
    Math.abs(rowDistance) !== Math.abs(columnDistance)
  ) {
    return null;
  }

  const rowStep = Math.sign(rowDistance);
  const columnStep = Math.sign(columnDistance);
  const length = Math.max(Math.abs(rowDistance), Math.abs(columnDistance)) + 1;
  return Array.from(
    { length },
    (_, index) => (startRow + rowStep * index) * grid.columns + startColumn + columnStep * index,
  );
}

export function getWordSearchTargetPath(question: WordSearchQuestion, target: WordSearchTarget) {
  return getWordSearchPath(question.grid, target.startCell, target.endCell);
}

function segmentKey(startCell: number, endCell: number) {
  return `${Math.min(startCell, endCell)}:${Math.max(startCell, endCell)}`;
}

function findWordOccurrences(question: WordSearchQuestion, word: string) {
  const normalizedWord = normalizeWordSearchText(word);
  const wordLength = Array.from(normalizedWord).length;
  const occurrences = new Set<string>();
  const directions = [-1, 0, 1].flatMap((rowStep) =>
    [-1, 0, 1]
      .filter((columnStep) => rowStep !== 0 || columnStep !== 0)
      .map((columnStep) => [rowStep, columnStep] as const),
  );

  for (let startCell = 0; startCell < question.letters.length; startCell += 1) {
    const startRow = Math.floor(startCell / question.grid.columns);
    const startColumn = startCell % question.grid.columns;
    for (const [rowStep, columnStep] of directions) {
      const cells: number[] = [];
      for (let index = 0; index < wordLength; index += 1) {
        const row = startRow + rowStep * index;
        const column = startColumn + columnStep * index;
        if (row < 0 || row >= question.grid.rows || column < 0 || column >= question.grid.columns) {
          cells.length = 0;
          break;
        }
        cells.push(row * question.grid.columns + column);
      }
      if (
        cells.length === wordLength &&
        cells.map((cell) => normalizeWordSearchText(question.letters[cell])).join("") ===
          normalizedWord
      ) {
        occurrences.add(segmentKey(cells[0], cells.at(-1)!));
      }
    }
  }

  return occurrences;
}

export function isValidWordSearchConfiguration(question: WordSearchQuestion) {
  const { rows, columns } = question.grid;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < MIN_GRID_SIZE ||
    rows > MAX_GRID_SIZE ||
    columns < MIN_GRID_SIZE ||
    columns > MAX_GRID_SIZE ||
    question.letters.length !== rows * columns ||
    question.targets.length < MIN_TARGETS ||
    question.targets.length > MAX_TARGETS
  ) {
    return false;
  }

  if (
    !question.letters.every((letter) => {
      const normalized = normalizeWordSearchText(letter);
      return Array.from(normalized).length === 1 && SPANISH_LETTER.test(normalized);
    })
  ) {
    return false;
  }

  const ids = question.targets.map((target) => target.id);
  const words = question.targets.map((target) => normalizeWordSearchText(target.word));
  const segments = question.targets.map((target) => segmentKey(target.startCell, target.endCell));
  if (
    new Set(ids).size !== ids.length ||
    new Set(words).size !== words.length ||
    new Set(segments).size !== segments.length
  ) {
    return false;
  }

  return question.targets.every((target) => {
    const word = normalizeWordSearchText(target.word);
    const path = getWordSearchTargetPath(question, target);
    if (
      !target.id.trim() ||
      !SPANISH_WORD.test(word) ||
      !isCellInGrid(question, target.startCell) ||
      !isCellInGrid(question, target.endCell) ||
      !path ||
      path.length !== Array.from(word).length ||
      path.map((cell) => normalizeWordSearchText(question.letters[cell])).join("") !== word
    ) {
      return false;
    }
    const occurrences = findWordOccurrences(question, word);
    return occurrences.size === 1 && occurrences.has(segmentKey(target.startCell, target.endCell));
  });
}

export function isWordSearchAnswer(answer: AnswerValue | null): answer is WordSearchAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "foundWordIds" in answer &&
    Array.isArray(answer.foundWordIds) &&
    answer.foundWordIds.every((id) => typeof id === "string")
  );
}

export function calculateWordSearchMetrics(question: WordSearchQuestion, answer: WordSearchAnswer) {
  const targetIds = new Set(question.targets.map((target) => target.id));
  const foundIds = answer.foundWordIds;
  const valid =
    isValidWordSearchConfiguration(question) &&
    new Set(foundIds).size === foundIds.length &&
    foundIds.every((id) => targetIds.has(id));
  const foundWords = valid ? foundIds.length : 0;
  const totalWords = question.targets.length;
  return {
    valid,
    foundWords,
    totalWords,
    solved: valid && foundWords === totalWords,
  };
}

export function findWordSearchTarget(
  question: WordSearchQuestion,
  startCell: number,
  endCell: number,
) {
  const key = segmentKey(startCell, endCell);
  return question.targets.find((target) => segmentKey(target.startCell, target.endCell) === key);
}
