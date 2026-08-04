import type { PipesAnswer, PipesQuestion, PipesTileKind } from "@/types/game";

export const PIPES_ROWS = 5;
export const PIPES_COLUMNS = 5;
export const PIPES_CELL_COUNT = PIPES_ROWS * PIPES_COLUMNS;

export type PipeDirection = "north" | "east" | "south" | "west";

const DIRECTIONS: PipeDirection[] = ["north", "east", "south", "west"];
const OPPOSITE: Record<PipeDirection, PipeDirection> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};
const BASE_CONNECTIONS: Record<PipesTileKind, PipeDirection[]> = {
  end: ["north"],
  straight: ["north", "south"],
  corner: ["north", "east"],
  tee: ["north", "east", "south"],
};

export type PipesMetrics = {
  valid: boolean;
  connectedTiles: number;
  totalTiles: number;
  openConnections: number;
  isolatedComponents: number;
  solved: boolean;
};

function isRotation(value: number) {
  return Number.isInteger(value) && value >= 0 && value < 4;
}

function isCell(cell: number) {
  return Number.isInteger(cell) && cell >= 0 && cell < PIPES_CELL_COUNT;
}

function rotateDirection(direction: PipeDirection, rotation: number): PipeDirection {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + rotation) % DIRECTIONS.length];
}

export function getPipesConnections(kind: PipesTileKind, rotation: number): PipeDirection[] {
  if (!isRotation(rotation)) return [];
  return BASE_CONNECTIONS[kind].map((direction) => rotateDirection(direction, rotation));
}

export function getPipesNeighbor(cell: number, direction: PipeDirection) {
  const row = Math.floor(cell / PIPES_COLUMNS);
  const column = cell % PIPES_COLUMNS;
  if (direction === "north") return row > 0 ? cell - PIPES_COLUMNS : null;
  if (direction === "east") return column < PIPES_COLUMNS - 1 ? cell + 1 : null;
  if (direction === "south") return row < PIPES_ROWS - 1 ? cell + PIPES_COLUMNS : null;
  return column > 0 ? cell - 1 : null;
}

function possibleRotations(kind: PipesTileKind) {
  return kind === "straight" ? [0, 1] : [0, 1, 2, 3];
}

function hasValidShape(question: PipesQuestion) {
  return (
    question.grid.rows === PIPES_ROWS &&
    question.grid.columns === PIPES_COLUMNS &&
    question.tiles.length === PIPES_CELL_COUNT &&
    question.tiles.every((tile) => tile in BASE_CONNECTIONS) &&
    question.initialRotations.length === PIPES_CELL_COUNT &&
    question.solutionRotations.length === PIPES_CELL_COUNT &&
    question.initialRotations.every(isRotation) &&
    question.solutionRotations.every(isRotation) &&
    isCell(question.source)
  );
}

export function getPipesConnectedCells(question: PipesQuestion, rotations: number[]) {
  const connected = new Set<number>([question.source]);
  const queue = [question.source];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    for (const direction of getPipesConnections(question.tiles[cell], rotations[cell])) {
      const neighbor = getPipesNeighbor(cell, direction);
      if (
        neighbor !== null &&
        getPipesConnections(question.tiles[neighbor], rotations[neighbor]).includes(
          OPPOSITE[direction],
        ) &&
        !connected.has(neighbor)
      ) {
        connected.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return connected;
}

function countOpenConnections(question: PipesQuestion, rotations: number[]) {
  let openConnections = 0;
  question.tiles.forEach((kind, cell) => {
    for (const direction of getPipesConnections(kind, rotations[cell])) {
      const neighbor = getPipesNeighbor(cell, direction);
      if (
        neighbor === null ||
        !getPipesConnections(question.tiles[neighbor], rotations[neighbor]).includes(
          OPPOSITE[direction],
        )
      ) {
        openConnections += 1;
      }
    }
  });
  return openConnections;
}

function componentCount(question: PipesQuestion, rotations: number[]) {
  const unseen = new Set(Array.from({ length: PIPES_CELL_COUNT }, (_, cell) => cell));
  let components = 0;
  while (unseen.size) {
    components += 1;
    const first = unseen.values().next().value as number;
    const queue = [first];
    unseen.delete(first);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const cell = queue[cursor];
      for (const direction of getPipesConnections(question.tiles[cell], rotations[cell])) {
        const neighbor = getPipesNeighbor(cell, direction);
        if (
          neighbor !== null &&
          unseen.has(neighbor) &&
          getPipesConnections(question.tiles[neighbor], rotations[neighbor]).includes(
            OPPOSITE[direction],
          )
        ) {
          unseen.delete(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return components;
}

function isSolvedBoard(question: PipesQuestion, rotations: number[]) {
  if (
    !hasValidShape(question) ||
    rotations.length !== PIPES_CELL_COUNT ||
    !rotations.every(isRotation)
  ) {
    return false;
  }
  const openConnections = countOpenConnections(question, rotations);
  if (openConnections) return false;
  return getPipesConnectedCells(question, rotations).size === PIPES_CELL_COUNT;
}

export function countPipesSolutions(question: PipesQuestion, limit = 2) {
  if (!hasValidShape(question) || limit <= 0) return 0;
  const rotations = Array<number>(PIPES_CELL_COUNT).fill(-1);
  let solutions = 0;

  const compatibleWithPlacedNeighbors = (cell: number, rotation: number) => {
    const connections = getPipesConnections(question.tiles[cell], rotation);
    for (const direction of DIRECTIONS) {
      const neighbor = getPipesNeighbor(cell, direction);
      const hasConnection = connections.includes(direction);
      if (neighbor === null) {
        if (hasConnection) return false;
        continue;
      }
      if (rotations[neighbor] !== -1) {
        const neighborHasConnection = getPipesConnections(
          question.tiles[neighbor],
          rotations[neighbor],
        ).includes(OPPOSITE[direction]);
        if (hasConnection !== neighborHasConnection) return false;
      }
    }
    return true;
  };

  const search = (cell: number) => {
    if (solutions >= limit) return;
    if (cell === PIPES_CELL_COUNT) {
      if (isSolvedBoard(question, rotations)) solutions += 1;
      return;
    }
    for (const rotation of possibleRotations(question.tiles[cell])) {
      if (!compatibleWithPlacedNeighbors(cell, rotation)) continue;
      rotations[cell] = rotation;
      search(cell + 1);
      rotations[cell] = -1;
      if (solutions >= limit) return;
    }
  };

  search(0);
  return solutions;
}

export function isValidPipesConfiguration(question: PipesQuestion) {
  return (
    hasValidShape(question) &&
    isSolvedBoard(question, question.solutionRotations) &&
    countPipesSolutions(question) === 1
  );
}

export function isPipesAnswer(answer: unknown): answer is PipesAnswer {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return false;
  const candidate = answer as { rotations?: unknown; moves?: unknown };
  return (
    Array.isArray(candidate.rotations) &&
    candidate.rotations.length === PIPES_CELL_COUNT &&
    candidate.rotations.every((rotation) => typeof rotation === "number" && isRotation(rotation)) &&
    typeof candidate.moves === "number" &&
    Number.isInteger(candidate.moves) &&
    candidate.moves >= 0
  );
}

export function calculatePipesMetrics(question: PipesQuestion, answer: PipesAnswer): PipesMetrics {
  if (!isValidPipesConfiguration(question) || !isPipesAnswer(answer)) {
    return {
      valid: false,
      connectedTiles: 0,
      totalTiles: PIPES_CELL_COUNT,
      openConnections: 0,
      isolatedComponents: 0,
      solved: false,
    };
  }
  const connectedTiles = getPipesConnectedCells(question, answer.rotations).size;
  const openConnections = countOpenConnections(question, answer.rotations);
  const isolatedComponents = componentCount(question, answer.rotations) - 1;
  return {
    valid: true,
    connectedTiles,
    totalTiles: PIPES_CELL_COUNT,
    openConnections,
    isolatedComponents,
    solved: openConnections === 0 && connectedTiles === PIPES_CELL_COUNT,
  };
}

export function rotatePipesTile(rotations: number[], cell: number) {
  return rotations.map((rotation, index) => (index === cell ? (rotation + 1) % 4 : rotation));
}
