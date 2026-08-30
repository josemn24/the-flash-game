import type { QueensAnswer, QueensQuestion } from "@/types/game";

export const QUEENS_ROWS = 5;
export const QUEENS_COLUMNS = 5;
export const QUEENS_CELL_COUNT = QUEENS_ROWS * QUEENS_COLUMNS;
export const QUEENS_REGION_COUNT = 5;

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

function isCell(cell: number) {
  return Number.isInteger(cell) && cell >= 0 && cell < QUEENS_CELL_COUNT;
}

function uniqueCells(cells: number[]) {
  return cells.every(isCell) && new Set(cells).size === cells.length;
}

function regionIsConnected(regions: number[], region: number) {
  const cells = regions.flatMap((value, cell) => (value === region ? [cell] : []));
  if (cells.length === 0) return false;

  const remaining = new Set(cells.slice(1));
  const queue = [cells[0]];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    const row = Math.floor(cell / QUEENS_COLUMNS);
    const column = cell % QUEENS_COLUMNS;
    const neighbors = [
      row > 0 ? cell - QUEENS_COLUMNS : -1,
      row < QUEENS_ROWS - 1 ? cell + QUEENS_COLUMNS : -1,
      column > 0 ? cell - 1 : -1,
      column < QUEENS_COLUMNS - 1 ? cell + 1 : -1,
    ];
    for (const neighbor of neighbors) {
      if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }
  return remaining.size === 0;
}

function hasValidShape(question: QueensQuestion) {
  const prefilledQueens = question.prefilledQueens ?? [];
  return (
    question.grid.rows === QUEENS_ROWS &&
    question.grid.columns === QUEENS_COLUMNS &&
    question.regions.length === QUEENS_CELL_COUNT &&
    question.regions.every(
      (region) => Number.isInteger(region) && region >= 0 && region < QUEENS_REGION_COUNT,
    ) &&
    Array.from({ length: QUEENS_REGION_COUNT }, (_, region) =>
      regionIsConnected(question.regions, region),
    ).every(Boolean) &&
    uniqueCells(prefilledQueens) &&
    prefilledQueens.every((cell) => question.solution.includes(cell)) &&
    question.solution.length === QUEENS_ROWS &&
    uniqueCells(question.solution)
  );
}

export function getQueensConflicts(question: QueensQuestion, queens: number[]) {
  const conflicts = new Map<number, Set<QueensConflictType>>();
  const add = (cell: number, type: QueensConflictType) => {
    const types = conflicts.get(cell) ?? new Set<QueensConflictType>();
    types.add(type);
    conflicts.set(cell, types);
  };

  for (let leftIndex = 0; leftIndex < queens.length; leftIndex += 1) {
    const left = queens[leftIndex];
    const leftRow = Math.floor(left / QUEENS_COLUMNS);
    const leftColumn = left % QUEENS_COLUMNS;
    for (let rightIndex = leftIndex + 1; rightIndex < queens.length; rightIndex += 1) {
      const right = queens[rightIndex];
      const rightRow = Math.floor(right / QUEENS_COLUMNS);
      const rightColumn = right % QUEENS_COLUMNS;
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

function rawMetrics(question: QueensQuestion, answer: QueensAnswer): QueensMetrics {
  const conflicts = getQueensConflicts(question, answer.queens);
  const countCompleted = (groupFor: (cell: number) => number) => {
    const counts = new Map<number, number>();
    answer.queens.forEach((cell) =>
      counts.set(groupFor(cell), (counts.get(groupFor(cell)) ?? 0) + 1),
    );
    return Array.from(
      { length: QUEENS_REGION_COUNT },
      (_, group) => counts.get(group) === 1,
    ).filter(Boolean).length;
  };
  const completedRows = countCompleted((cell) => Math.floor(cell / QUEENS_COLUMNS));
  const completedColumns = countCompleted((cell) => cell % QUEENS_COLUMNS);
  const completedRegions = countCompleted((cell) => question.regions[cell]);
  const solved =
    answer.queens.length === QUEENS_ROWS &&
    completedRows === QUEENS_ROWS &&
    completedColumns === QUEENS_COLUMNS &&
    completedRegions === QUEENS_REGION_COUNT &&
    conflicts.size === 0;

  return {
    valid: true,
    placedQueens: answer.queens.length,
    completedRows,
    completedColumns,
    completedRegions,
    conflictingQueens: conflicts.size,
    marksUsed: answer.marks.length,
    solved,
  };
}

export function countQueensSolutions(question: QueensQuestion, limit = 2) {
  if (!hasValidShape(question) || limit <= 0) return 0;
  const usedColumns = new Set<number>();
  const usedRegions = new Set<number>();
  let solutions = 0;

  const search = (row: number, previousColumn: number | null) => {
    if (solutions >= limit) return;
    if (row === QUEENS_ROWS) {
      solutions += 1;
      return;
    }
    for (let column = 0; column < QUEENS_COLUMNS; column += 1) {
      const cell = row * QUEENS_COLUMNS + column;
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

export function isQueensAnswer(answer: unknown): answer is QueensAnswer {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return false;
  const candidate = answer as { queens?: unknown; marks?: unknown };
  if (!Array.isArray(candidate.queens) || !Array.isArray(candidate.marks)) return false;
  const queens = candidate.queens;
  const marks = candidate.marks;
  return uniqueCells(queens) && uniqueCells(marks) && queens.every((cell) => !marks.includes(cell));
}

export function calculateQueensMetrics(
  question: QueensQuestion,
  answer: QueensAnswer,
): QueensMetrics {
  if (!isValidQueensConfiguration(question) || !isQueensAnswer(answer)) {
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
