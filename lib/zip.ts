import type { ZipAnswer, ZipPublicQuestion, ZipQuestion } from "@/types/game";

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

export type ZipBoardConfiguration = Pick<ZipPublicQuestion, "grid" | "checkpoints">;

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

function hasValidPublicShape(configuration: ZipBoardConfiguration) {
  const checkpointCells = configuration.checkpoints.map((checkpoint) => checkpoint.cell);
  return (
    configuration.grid.rows === ZIP_ROWS &&
    configuration.grid.columns === ZIP_COLUMNS &&
    configuration.checkpoints.length >= 2 &&
    configuration.checkpoints.length <= ZIP_CELL_COUNT &&
    configuration.checkpoints.every(
      (checkpoint, index) => checkpoint.value === index + 1 && isCell(checkpoint.cell),
    ) &&
    new Set(checkpointCells).size === checkpointCells.length
  );
}

function hasValidShape(question: ZipQuestion) {
  return hasValidPublicShape(question) && question.solution.length === ZIP_CELL_COUNT;
}

function checkpointValueAt(configuration: ZipBoardConfiguration, cell: number) {
  return configuration.checkpoints.find((checkpoint) => checkpoint.cell === cell)?.value;
}

function validatePath(
  configuration: ZipBoardConfiguration,
  path: number[],
  requireComplete: boolean,
) {
  if (!hasValidPublicShape(configuration) || path.length === 0 || path.length > ZIP_CELL_COUNT) {
    return false;
  }
  if (path[0] !== configuration.checkpoints[0].cell) return false;
  if (path.some((cell) => !isCell(cell)) || new Set(path).size !== path.length) return false;

  let nextCheckpoint = 2;
  for (let index = 1; index < path.length; index += 1) {
    if (!areZipNeighbors(path[index - 1], path[index])) return false;
    const checkpoint = checkpointValueAt(configuration, path[index]);
    if (checkpoint !== undefined) {
      if (checkpoint !== nextCheckpoint) return false;
      if (checkpoint === configuration.checkpoints.length && index !== ZIP_CELL_COUNT - 1) {
        return false;
      }
      nextCheckpoint += 1;
    }
  }

  if (!requireComplete) return true;
  return (
    path.length === ZIP_CELL_COUNT &&
    path.at(-1) === configuration.checkpoints.at(-1)?.cell &&
    nextCheckpoint === configuration.checkpoints.length + 1
  );
}

export function isValidZipPublicConfiguration(value: unknown): value is ZipBoardConfiguration {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const grid = candidate.grid;
  const checkpoints = candidate.checkpoints;
  if (!grid || typeof grid !== "object" || Array.isArray(grid) || !Array.isArray(checkpoints)) {
    return false;
  }
  const gridValue = grid as Record<string, unknown>;
  if (
    Object.keys(gridValue).some((key) => key !== "rows" && key !== "columns") ||
    gridValue.rows !== ZIP_ROWS ||
    gridValue.columns !== ZIP_COLUMNS ||
    checkpoints.some((checkpoint) => {
      if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) {
        return true;
      }
      const value = checkpoint as Record<string, unknown>;
      return (
        Object.keys(value).some((key) => !["value", "cell", "label"].includes(key)) ||
        !Number.isSafeInteger(value.value) ||
        !Number.isSafeInteger(value.cell) ||
        (value.label !== undefined && typeof value.label !== "string")
      );
    })
  ) {
    return false;
  }
  return hasValidPublicShape(candidate as unknown as ZipBoardConfiguration);
}

export function isValidZipPath(configuration: ZipBoardConfiguration, path: number[]) {
  return validatePath(configuration, path, false);
}

export function isCompleteZipPath(configuration: ZipBoardConfiguration, path: number[]) {
  return validatePath(configuration, path, true);
}

export function countZipSolutions(configuration: ZipBoardConfiguration, limit = 2) {
  if (!hasValidPublicShape(configuration) || limit <= 0) return 0;
  const start = configuration.checkpoints[0].cell;
  const final = configuration.checkpoints.at(-1)?.cell;
  if (final === undefined) return 0;

  const checkpointsByCell = new Map(
    configuration.checkpoints.map((checkpoint) => [checkpoint.cell, checkpoint.value]),
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
      if (cell === final && nextCheckpoint === configuration.checkpoints.length + 1) {
        solutions += 1;
      }
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

export function calculateZipMetrics(
  configuration: ZipBoardConfiguration,
  answer: ZipAnswer,
): ZipMetrics {
  const valid = isValidZipPath(configuration, answer.path);
  const reachedCheckpoint = valid
    ? configuration.checkpoints.reduce(
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
    totalCheckpoints: configuration.checkpoints.length,
    completed: valid && isCompleteZipPath(configuration, answer.path),
  };
}

export function applyZipCellSelection(
  configuration: ZipBoardConfiguration,
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
  if (!isValidZipPath(configuration, nextPath)) {
    return {
      path,
      changed: false,
      message: "Debes recorrer los números en orden y dejar el último para el final.",
    };
  }

  const checkpoint = checkpointValueAt(configuration, cell);
  return {
    path: nextPath,
    changed: true,
    message: checkpoint
      ? `Número ${checkpoint} alcanzado.`
      : `Camino extendido a la casilla ${cell + 1}.`,
  };
}
