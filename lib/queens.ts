import type { QueensAnswer, QueensBoardSize, QueensGrid, QueensQuestion } from "@/types/gameplay/practice";

export const QUEENS_MIN_SIZE = 4;
export const QUEENS_MAX_SIZE = 8;
export const QUEENS_MAX_CELL_COUNT = QUEENS_MAX_SIZE * QUEENS_MAX_SIZE;

export type QueensConflictType = "row" | "column" | "region" | "contact";

export type QueensMetrics = {
  valid: boolean;
  placedQueens: number;
  completedRows: number;
  completedColumns: number;
  completedRegions: number;
  conflictingQueens: number;
  marksUsed: number;
  solved: boolean;
};

export type QueensDraftQuestion = {
  readonly grid: QueensGrid;
  readonly regions: readonly number[];
  readonly prefilledQueens?: readonly number[];
};

export function isQueensBoardSize(value: unknown): value is QueensGrid["rows"] {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= QUEENS_MIN_SIZE &&
    value <= QUEENS_MAX_SIZE
  );
}

export function queensGrid(size: QueensBoardSize): QueensGrid {
  return { rows: size, columns: size } as QueensGrid;
}

export function queensCellCount(grid: QueensGrid) {
  return grid.rows * grid.columns;
}

function isCell(cell: number, grid: QueensGrid) {
  return Number.isInteger(cell) && cell >= 0 && cell < queensCellCount(grid);
}

function uniqueCells(cells: number[], grid?: QueensGrid) {
  const effectiveGrid = grid ?? { rows: QUEENS_MAX_SIZE, columns: QUEENS_MAX_SIZE };
  return cells.every((cell) => isCell(cell, effectiveGrid)) && new Set(cells).size === cells.length;
}

function isSquareGrid(grid: QueensGrid) {
  return grid.rows === grid.columns && isQueensBoardSize(grid.rows);
}

function regionIsConnected(regions: readonly number[], region: number, size: number) {
  const cells = regions.flatMap((value, cell) => (value === region ? [cell] : []));
  if (cells.length === 0) return false;

  const remaining = new Set(cells.slice(1));
  const queue = [cells[0]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    const row = Math.floor(cell / size);
    const column = cell % size;
    const neighbors = [
      row > 0 ? (row - 1) * size + column : -1,
      row < size - 1 ? (row + 1) * size + column : -1,
      column > 0 ? row * size + column - 1 : -1,
      column < size - 1 ? row * size + column + 1 : -1,
    ];
    for (const neighbor of neighbors) {
      if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }
  return remaining.size === 0;
}

function hasValidShape(question: QueensQuestion) {
  const prefilledQueens = question.prefilledQueens ?? [];
  const grid = question.grid;
  if (!isSquareGrid(grid)) return false;
  const size = grid.rows;
  const cellCount = queensCellCount(grid);
  return (
    question.regions.length === cellCount &&
    question.regions.every((region) => Number.isInteger(region) && region >= 0 && region < size) &&
    Array.from({ length: size }, (_, region) =>
      regionIsConnected(question.regions, region, size),
    ).every(Boolean) &&
    uniqueCells(prefilledQueens, grid) &&
    prefilledQueens.every((cell) => question.solution.includes(cell)) &&
    question.solution.length === size &&
    uniqueCells(question.solution, grid)
  );
}

export function getQueensConflicts(
  question: { readonly grid: QueensGrid; readonly regions: readonly number[] },
  queens: number[],
) {
  const size = question.grid.rows;
  const conflicts = new Map<number, Set<QueensConflictType>>();
  const add = (cell: number, type: QueensConflictType) => {
    const types = conflicts.get(cell) ?? new Set<QueensConflictType>();
    types.add(type);
    conflicts.set(cell, types);
  };

  for (let leftIndex = 0; leftIndex < queens.length; leftIndex += 1) {
    const left = queens[leftIndex];
    const leftRow = Math.floor(left / size);
    const leftColumn = left % size;
    for (let rightIndex = leftIndex + 1; rightIndex < queens.length; rightIndex += 1) {
      const right = queens[rightIndex];
      const rightRow = Math.floor(right / size);
      const rightColumn = right % size;
      if (leftRow === rightRow) {
        add(left, "row");
        add(right, "row");
      }
      if (leftColumn === rightColumn) {
        add(left, "column");
        add(right, "column");
      }
      if (question.regions[left] === question.regions[right]) {
        add(left, "region");
        add(right, "region");
      }
      if (Math.max(Math.abs(leftRow - rightRow), Math.abs(leftColumn - rightColumn)) === 1) {
        add(left, "contact");
        add(right, "contact");
      }
    }
  }
  return conflicts;
}

function metricsFor(question: QueensDraftQuestion, queens: readonly number[], marksUsed: number) {
  const size = question.grid.rows;
  const conflicts = getQueensConflicts(question, [...queens]);
  const countCompleted = (groupFor: (cell: number) => number) => {
    const counts = new Map<number, number>();
    queens.forEach((cell) => counts.set(groupFor(cell), (counts.get(groupFor(cell)) ?? 0) + 1));
    return Array.from({ length: size }, (_, group) => counts.get(group) === 1).filter(Boolean)
      .length;
  };
  const completedRows = countCompleted((cell) => Math.floor(cell / size));
  const completedColumns = countCompleted((cell) => cell % size);
  const completedRegions = countCompleted((cell) => question.regions[cell]);
  return {
    valid: uniqueCells([...queens], question.grid),
    placedQueens: queens.length,
    completedRows,
    completedColumns,
    completedRegions,
    conflictingQueens: conflicts.size,
    marksUsed,
    solved:
      queens.length === size &&
      completedRows === size &&
      completedColumns === size &&
      completedRegions === size &&
      conflicts.size === 0,
  } satisfies QueensMetrics;
}

export function calculateQueensDraftMetrics(
  question: QueensDraftQuestion,
  queens: readonly number[],
): Omit<QueensMetrics, "marksUsed"> {
  const metrics = metricsFor(question, queens, 0);
  return {
    valid: metrics.valid,
    placedQueens: metrics.placedQueens,
    completedRows: metrics.completedRows,
    completedColumns: metrics.completedColumns,
    completedRegions: metrics.completedRegions,
    conflictingQueens: metrics.conflictingQueens,
    solved: metrics.solved,
  };
}

function rawMetrics(question: QueensQuestion, answer: QueensAnswer): QueensMetrics {
  return metricsFor(question, answer.queens, answer.marks.length);
}

export function countQueensSolutions(question: QueensQuestion, limit = 2) {
  if (!hasValidShape(question) || limit <= 0) return 0;
  const size = question.grid.rows;
  const usedColumns = new Set<number>();
  const usedRegions = new Set<number>();
  let solutions = 0;

  const search = (row: number, previousColumn: number | null) => {
    if (solutions >= limit) return;
    if (row === size) {
      solutions += 1;
      return;
    }
    for (let column = 0; column < size; column += 1) {
      const cell = row * size + column;
      const region = question.regions[cell];
      if (
        usedColumns.has(column) ||
        usedRegions.has(region) ||
        (previousColumn !== null && Math.abs(previousColumn - column) <= 1)
      ) {
        continue;
      }
      usedColumns.add(column);
      usedRegions.add(region);
      search(row + 1, column);
      usedColumns.delete(column);
      usedRegions.delete(region);
      if (solutions >= limit) return;
    }
  };

  search(0, null);
  return solutions;
}

export function isValidQueensConfiguration(question: QueensQuestion) {
  if (!hasValidShape(question)) return false;
  const solutionMetrics = rawMetrics(question, { queens: question.solution, marks: [] });
  return solutionMetrics.solved && countQueensSolutions(question) === 1;
}

export function isQueensAnswer(answer: unknown, grid?: QueensGrid): answer is QueensAnswer {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return false;
  const candidate = answer as { queens?: unknown; marks?: unknown };
  if (!Array.isArray(candidate.queens) || !Array.isArray(candidate.marks)) return false;
  const queens = candidate.queens;
  const marks = candidate.marks;
  return (
    uniqueCells(queens, grid) &&
    uniqueCells(marks, grid) &&
    queens.every((cell) => !marks.includes(cell))
  );
}

export function calculateQueensMetrics(
  question: QueensQuestion,
  answer: QueensAnswer,
): QueensMetrics {
  if (!isValidQueensConfiguration(question) || !isQueensAnswer(answer, question.grid)) {
    return {
      valid: false,
      placedQueens: 0,
      completedRows: 0,
      completedColumns: 0,
      completedRegions: 0,
      conflictingQueens: 0,
      marksUsed: 0,
      solved: false,
    };
  }
  return rawMetrics(question, answer);
}
