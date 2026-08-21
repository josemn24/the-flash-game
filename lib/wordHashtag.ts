import type {
  WordHashtagAnswer,
  WordHashtagQuestion,
  WordHashtagSwap,
  WordHashtagWords,
} from "@/types/game";

export const WORD_HASHTAG_SIZE = 5;
export const WORD_HASHTAG_ACTIVE_CELLS = Array.from(
  { length: WORD_HASHTAG_SIZE * WORD_HASHTAG_SIZE },
  (_, cell) => cell,
).filter((cell) => {
  const row = Math.floor(cell / WORD_HASHTAG_SIZE);
  const column = cell % WORD_HASHTAG_SIZE;
  return row === 1 || row === 3 || column === 1 || column === 3;
});

const ACTIVE_CELL_SET = new Set(WORD_HASHTAG_ACTIVE_CELLS);
const WORD_CELLS = {
  top: [5, 6, 7, 8, 9],
  bottom: [15, 16, 17, 18, 19],
  left: [1, 6, 11, 16, 21],
  right: [3, 8, 13, 18, 23],
} as const satisfies Record<keyof WordHashtagWords, readonly number[]>;

export type WordHashtagReplayResult = {
  valid: boolean;
  letters: Array<string | null>;
  appliedMoves: number;
  errorIndex: number | null;
  solved: boolean;
};

export type WordHashtagMetrics = {
  valid: boolean;
  correctCells: number;
  totalCells: number;
  completedWords: number;
  totalWords: number;
  movesUsed: number;
  movesRemaining: number;
  optimalMoves: number;
  solved: boolean;
};

export function normalizeWordHashtagWord(value: string) {
  return value
    .trim()
    .toLocaleUpperCase("es-ES")
    .normalize("NFD")
    .replace(/N\u0303/g, "Ñ")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizedLetter(value: string | null) {
  if (value === null) return null;
  return normalizeWordHashtagWord(value);
}

function isValidWord(value: string) {
  const normalized = normalizeWordHashtagWord(value);
  return Array.from(normalized).length === WORD_HASHTAG_SIZE && /^[A-ZÑ]+$/.test(normalized);
}

function isValidLetter(value: string | null): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizedLetter(value);
  return normalized !== null && Array.from(normalized).length === 1 && /^[A-ZÑ]$/.test(normalized);
}

export function buildWordHashtagSolution(words: WordHashtagWords) {
  if (!Object.values(words).every(isValidWord)) return null;
  const solution: Array<string | null> = Array.from({ length: 25 }, () => null);

  for (const wordName of Object.keys(WORD_CELLS) as Array<keyof WordHashtagWords>) {
    const letters = Array.from(normalizeWordHashtagWord(words[wordName]));
    for (const [index, cell] of WORD_CELLS[wordName].entries()) {
      if (solution[cell] !== null && solution[cell] !== letters[index]) return null;
      solution[cell] = letters[index];
    }
  }

  return solution;
}

export function getWordHashtagWords(letters: Array<string | null>) {
  return Object.fromEntries(
    (Object.keys(WORD_CELLS) as Array<keyof WordHashtagWords>).map((wordName) => [
      wordName,
      WORD_CELLS[wordName].map((cell) => normalizedLetter(letters[cell]) ?? "").join(""),
    ]),
  ) as WordHashtagWords;
}

function normalizedBoard(letters: Array<string | null>) {
  return letters.map(normalizedLetter);
}

function activeSequence(letters: Array<string | null>) {
  return WORD_HASHTAG_ACTIVE_CELLS.map((cell) => letters[cell] ?? "");
}

function sameLetters(left: string[], right: string[]) {
  const sort = (letters: string[]) =>
    [...letters].sort((first, second) => first.localeCompare(second, "es")).join("");
  return sort(left) === sort(right);
}

export function calculateMinimumWordHashtagSwaps(
  initialLetters: Array<string | null>,
  solutionLetters: Array<string | null>,
) {
  const initial = activeSequence(normalizedBoard(initialLetters));
  const target = activeSequence(normalizedBoard(solutionLetters));
  if (initial.length !== target.length || !sameLetters(initial, target))
    return Number.POSITIVE_INFINITY;

  const memo = new Map<string, number>();
  const visit = (state: string[]): number => {
    const key = state.join("");
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const firstMismatch = state.findIndex((letter, index) => letter !== target[index]);
    if (firstMismatch === -1) return 0;

    let minimum = Number.POSITIVE_INFINITY;
    for (let candidate = firstMismatch + 1; candidate < state.length; candidate += 1) {
      if (
        state[candidate] !== target[firstMismatch] ||
        state[candidate] === target[candidate] ||
        state[candidate] === state[firstMismatch]
      ) {
        continue;
      }
      const next = [...state];
      [next[firstMismatch], next[candidate]] = [next[candidate], next[firstMismatch]];
      minimum = Math.min(minimum, 1 + visit(next));
    }

    memo.set(key, minimum);
    return minimum;
  };

  return visit(initial);
}

function applySwapToBoard(
  solution: Array<string | null>,
  letters: Array<string | null>,
  swap: WordHashtagSwap,
) {
  const { fromCell, toCell } = swap;
  if (
    !Number.isInteger(fromCell) ||
    !Number.isInteger(toCell) ||
    fromCell === toCell ||
    !ACTIVE_CELL_SET.has(fromCell) ||
    !ACTIVE_CELL_SET.has(toCell) ||
    letters[fromCell] === null ||
    letters[toCell] === null ||
    letters[fromCell] === letters[toCell] ||
    letters[fromCell] === solution[fromCell] ||
    letters[toCell] === solution[toCell]
  ) {
    return null;
  }

  const next = [...letters];
  [next[fromCell], next[toCell]] = [next[toCell], next[fromCell]];
  return next;
}

export function applyWordHashtagSwap(
  question: WordHashtagQuestion,
  letters: Array<string | null>,
  swap: WordHashtagSwap,
) {
  const solution = buildWordHashtagSolution(question.words);
  if (!solution || letters.length !== 25) return null;
  return applySwapToBoard(solution, normalizedBoard(letters), swap);
}

function boardSolved(letters: Array<string | null>, solution: Array<string | null>) {
  return WORD_HASHTAG_ACTIVE_CELLS.every((cell) => letters[cell] === solution[cell]);
}

export function replayWordHashtagSwaps(
  question: WordHashtagQuestion,
  swaps: WordHashtagSwap[],
): WordHashtagReplayResult {
  const solution = buildWordHashtagSolution(question.words);
  let letters = normalizedBoard(question.initialLetters);
  if (!solution || letters.length !== 25) {
    return { valid: false, letters, appliedMoves: 0, errorIndex: 0, solved: false };
  }

  for (const [index, swap] of swaps.entries()) {
    if (index >= question.maxMoves) {
      return {
        valid: false,
        letters,
        appliedMoves: index,
        errorIndex: index,
        solved: boardSolved(letters, solution),
      };
    }
    const next = applySwapToBoard(solution, letters, swap);
    if (!next) {
      return {
        valid: false,
        letters,
        appliedMoves: index,
        errorIndex: index,
        solved: boardSolved(letters, solution),
      };
    }
    letters = next;
  }

  return {
    valid: true,
    letters,
    appliedMoves: swaps.length,
    errorIndex: null,
    solved: boardSolved(letters, solution),
  };
}

export function isValidWordHashtagConfiguration(question: WordHashtagQuestion) {
  if (
    question.grid.rows !== WORD_HASHTAG_SIZE ||
    question.grid.columns !== WORD_HASHTAG_SIZE ||
    question.initialLetters.length !== 25 ||
    !Number.isInteger(question.maxMoves) ||
    question.maxMoves <= 0
  ) {
    return false;
  }

  const solution = buildWordHashtagSolution(question.words);
  if (!solution) return false;
  const initial = normalizedBoard(question.initialLetters);
  const validShape = initial.every((letter, cell) =>
    ACTIVE_CELL_SET.has(cell) ? isValidLetter(letter) : letter === null,
  );
  if (!validShape || boardSolved(initial, solution)) return false;

  const initialActive = activeSequence(initial);
  const solutionActive = activeSequence(solution);
  if (!sameLetters(initialActive, solutionActive)) return false;
  const minimum = calculateMinimumWordHashtagSwaps(initial, solution);
  return Number.isFinite(minimum) && minimum > 0 && minimum <= question.maxMoves;
}

export function isWordHashtagAnswer(answer: unknown): answer is WordHashtagAnswer {
  return (
    answer !== null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "swaps" in answer &&
    Array.isArray(answer.swaps) &&
    answer.swaps.every(
      (swap) =>
        swap !== null &&
        typeof swap === "object" &&
        "fromCell" in swap &&
        "toCell" in swap &&
        Number.isInteger(swap.fromCell) &&
        Number.isInteger(swap.toCell),
    )
  );
}

export function calculateWordHashtagMetrics(
  question: WordHashtagQuestion,
  answer: WordHashtagAnswer,
): WordHashtagMetrics {
  const emptyMetrics = {
    valid: false,
    correctCells: 0,
    totalCells: WORD_HASHTAG_ACTIVE_CELLS.length,
    completedWords: 0,
    totalWords: 4,
    movesUsed: 0,
    movesRemaining: Math.max(0, question.maxMoves),
    optimalMoves: 0,
    solved: false,
  };
  if (!isValidWordHashtagConfiguration(question) || !isWordHashtagAnswer(answer)) {
    return emptyMetrics;
  }

  const solution = buildWordHashtagSolution(question.words)!;
  const replay = replayWordHashtagSwaps(question, answer.swaps);
  if (!replay.valid) return emptyMetrics;
  const currentWords = getWordHashtagWords(replay.letters);
  const solutionWords = getWordHashtagWords(solution);
  const completedWords = (Object.keys(WORD_CELLS) as Array<keyof WordHashtagWords>).filter(
    (wordName) => currentWords[wordName] === solutionWords[wordName],
  ).length;

  return {
    valid: true,
    correctCells: WORD_HASHTAG_ACTIVE_CELLS.filter(
      (cell) => replay.letters[cell] === solution[cell],
    ).length,
    totalCells: WORD_HASHTAG_ACTIVE_CELLS.length,
    completedWords,
    totalWords: 4,
    movesUsed: replay.appliedMoves,
    movesRemaining: Math.max(0, question.maxMoves - replay.appliedMoves),
    optimalMoves: calculateMinimumWordHashtagSwaps(question.initialLetters, solution),
    solved: replay.solved,
  };
}
