import type { ZipAnswer, ZipQuestion } from "@/types/game";

export const ZIP_ROWS = 5;
export const ZIP_COLUMNS = 5;
export const ZIP_CELL_COUNT = ZIP_ROWS * ZIP_COLUMNS;

export type ZipMetrics = {
  valid: boolean;
  coveredCells: number;
  totalCells: number;
  reachedCheckpoint: number;
  totalCheckpoints: number;
  completed: boolean;
};

export type ZipCellSelectionResult = {
  path: number[];
  changed: boolean;
  message: string;
};

function isCell(cell: number) {
  return Number.isInteger(cell) && cell >= 0 && cell < ZIP_CELL_COUNT;
}

export function areZipNeighbors(left: number, right: number) {
  if (!isCell(left) || !isCell(right)) return false;
  const leftRow = Math.floor(left / ZIP_COLUMNS);
  const rightRow = Math.floor(right / ZIP_COLUMNS);
  const leftColumn = left % ZIP_COLUMNS;
  const rightColumn = right % ZIP_COLUMNS;
  return Math.abs(leftRow - rightRow) + Math.abs(leftColumn - rightColumn) === 1;
}

export function getZipNeighbors(cell: number) {
  if (!isCell(cell)) return [];
  return Array.from({ length: ZIP_CELL_COUNT }, (_, candidate) => candidate).filter((candidate) =>
    areZipNeighbors(cell, candidate),
  );
}

function hasValidShape(question: ZipQuestion) {
  const checkpointCells = question.checkpoints.map((checkpoint) => checkpoint.cell);
  return (
    question.grid.rows === ZIP_ROWS &&
    question.grid.columns === ZIP_COLUMNS &&
    question.checkpoints.length >= 2 &&
    question.checkpoints.every(
      (checkpoint, index) => checkpoint.value === index + 1 && isCell(checkpoint.cell),
    ) &&
    new Set(checkpointCells).size === checkpointCells.length &&
    question.solution.length === ZIP_CELL_COUNT
  );
}

function checkpointValueAt(question: ZipQuestion, cell: number) {
  return question.checkpoints.find((checkpoint) => checkpoint.cell === cell)?.value;
}

function validatePath(question: ZipQuestion, path: number[], requireComplete: boolean) {
  if (!hasValidShape(question) || path.length === 0 || path.length > ZIP_CELL_COUNT) return false;
  if (path[0] !== question.checkpoints[0].cell) return false;
  if (path.some((cell) => !isCell(cell)) || new Set(path).size !== path.length) return false;

  let nextCheckpoint = 2;
  for (let index = 1; index < path.length; index += 1) {
    if (!areZipNeighbors(path[index - 1], path[index])) return false;
    const checkpoint = checkpointValueAt(question, path[index]);
    if (checkpoint !== undefined) {
      if (checkpoint !== nextCheckpoint) return false;
      if (checkpoint === question.checkpoints.length && index !== ZIP_CELL_COUNT - 1) return false;
      nextCheckpoint += 1;
    }
  }

  if (!requireComplete) return true;
  return (
    path.length === ZIP_CELL_COUNT &&
    path.at(-1) === question.checkpoints.at(-1)?.cell &&
    nextCheckpoint === question.checkpoints.length + 1
  );
}

export function isValidZipPath(question: ZipQuestion, path: number[]) {
  return validatePath(question, path, false);
}

export function isCompleteZipPath(question: ZipQuestion, path: number[]) {
  return validatePath(question, path, true);
}

export function countZipSolutions(question: ZipQuestion, limit = 2) {
  if (!hasValidShape(question) || limit <= 0) return 0;
  const start = question.checkpoints[0].cell;
  const final = question.checkpoints.at(-1)?.cell;
  if (final === undefined) return 0;

  const checkpointsByCell = new Map(
    question.checkpoints.map((checkpoint) => [checkpoint.cell, checkpoint.value]),
  );
  const visited = new Set([start]);
  let solutions = 0;

  const remainingCellsAreConnected = () => {
    const remaining = Array.from({ length: ZIP_CELL_COUNT }, (_, cell) => cell).filter(
      (cell) => !visited.has(cell),
    );
    if (remaining.length <= 1) return true;
    const unseen = new Set(remaining);
    const queue = [remaining[0]];
    unseen.delete(remaining[0]);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const neighbor of getZipNeighbors(queue[cursor])) {
        if (unseen.delete(neighbor)) queue.push(neighbor);
      }
    }
    return unseen.size === 0;
  };

  const search = (cell: number, depth: number, nextCheckpoint: number) => {
    if (solutions >= limit) return;
    if (depth === ZIP_CELL_COUNT) {
      if (cell === final && nextCheckpoint === question.checkpoints.length + 1) solutions += 1;
      return;
    }

    for (const neighbor of getZipNeighbors(cell)) {
      if (visited.has(neighbor)) continue;
      const checkpoint = checkpointsByCell.get(neighbor);
      if (checkpoint !== undefined && checkpoint !== nextCheckpoint) continue;
      if (neighbor === final && depth !== ZIP_CELL_COUNT - 1) continue;

      visited.add(neighbor);
      if (remainingCellsAreConnected()) {
        search(
          neighbor,
          depth + 1,
          checkpoint === nextCheckpoint ? nextCheckpoint + 1 : nextCheckpoint,
        );
      }
      visited.delete(neighbor);
      if (solutions >= limit) return;
    }
  };

  search(start, 1, 2);
  return solutions;
}

export function isValidZipConfiguration(question: ZipQuestion) {
  return (
    hasValidShape(question) &&
    isCompleteZipPath(question, question.solution) &&
    countZipSolutions(question) === 1
  );
}

export function isValidZipAnswer(answer: unknown): answer is ZipAnswer {
  return (
    typeof answer === "object" &&
    answer !== null &&
    !Array.isArray(answer) &&
    "path" in answer &&
    Array.isArray(answer.path) &&
    answer.path.length > 0 &&
    answer.path.every((cell) => Number.isInteger(cell))
  );
}

export function calculateZipMetrics(question: ZipQuestion, answer: ZipAnswer): ZipMetrics {
  const valid = isValidZipPath(question, answer.path);
  const reachedCheckpoint = valid
    ? question.checkpoints.reduce(
        (highest, checkpoint) =>
          answer.path.includes(checkpoint.cell) ? checkpoint.value : highest,
        0,
      )
    : 0;
  return {
    valid,
    coveredCells: valid ? answer.path.length : 0,
    totalCells: ZIP_CELL_COUNT,
    reachedCheckpoint,
    totalCheckpoints: question.checkpoints.length,
    completed: valid && isCompleteZipPath(question, answer.path),
  };
}

export function applyZipCellSelection(
  question: ZipQuestion,
  path: number[],
  cell: number,
): ZipCellSelectionResult {
  if (!isCell(cell)) return { path, changed: false, message: "La celda no es válida." };
  const existingIndex = path.indexOf(cell);
  if (existingIndex >= 0) {
    if (existingIndex === path.length - 1) {
      return { path, changed: false, message: "Ya estás en esa celda." };
    }
    return {
      path: path.slice(0, existingIndex + 1),
      changed: true,
      message: `Camino recortado hasta la casilla ${cell + 1}.`,
    };
  }

  const current = path.at(-1);
  if (current === undefined || !areZipNeighbors(current, cell)) {
    return {
      path,
      changed: false,
      message: "Solo puedes avanzar a una celda ortogonal adyacente.",
    };
  }

  const nextPath = [...path, cell];
  if (!isValidZipPath(question, nextPath)) {
    return {
      path,
      changed: false,
      message: "Debes recorrer los números en orden y dejar el último para el final.",
    };
  }

  const checkpoint = checkpointValueAt(question, cell);
  return {
    path: nextPath,
    changed: true,
    message: checkpoint
      ? `Número ${checkpoint} alcanzado.`
      : `Camino extendido a la casilla ${cell + 1}.`,
  };
}
