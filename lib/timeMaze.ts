import type { TimeMazeQuestion } from "@/types/game";

export const TIME_MAZE_MIN_SIZE = 5;
export const TIME_MAZE_MAX_SIZE = 9;

export type MazeDirection = "up" | "right" | "down" | "left";

export const MAZE_DIRECTIONS = ["up", "right", "down", "left"] as const;

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function getTimeMazeStartIndex(question: TimeMazeQuestion) {
  return question.cells.indexOf("start");
}

export function getTimeMazeExitIndex(question: TimeMazeQuestion) {
  return question.cells.indexOf("exit");
}

export function getTimeMazeNeighbor(
  question: TimeMazeQuestion,
  position: number,
  direction: MazeDirection,
): number | null {
  const { rows, columns } = question.grid;
  const row = Math.floor(position / columns);
  const column = position % columns;
  const offsets: Record<MazeDirection, [number, number]> = {
    up: [-1, 0],
    right: [0, 1],
    down: [1, 0],
    left: [0, -1],
  };
  const [rowOffset, columnOffset] = offsets[direction];
  const nextRow = row + rowOffset;
  const nextColumn = column + columnOffset;
  if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns) return null;
  const nextPosition = nextRow * columns + nextColumn;
  return question.cells[nextPosition] === "wall" ? null : nextPosition;
}

function hasValidMazeShape(question: TimeMazeQuestion) {
  const { rows, columns } = question.grid;
  const validCells = new Set(["wall", "path", "start", "exit"]);
  return (
    isIntegerInRange(rows, TIME_MAZE_MIN_SIZE, TIME_MAZE_MAX_SIZE) &&
    isIntegerInRange(columns, TIME_MAZE_MIN_SIZE, TIME_MAZE_MAX_SIZE) &&
    question.cells.length === rows * columns &&
    question.cells.every((cell) => validCells.has(cell)) &&
    question.cells.filter((cell) => cell === "start").length === 1 &&
    question.cells.filter((cell) => cell === "exit").length === 1
  );
}

export function findShortestTimeMazePath(question: TimeMazeQuestion): number[] | null {
  if (!hasValidMazeShape(question)) return null;
  const start = getTimeMazeStartIndex(question);
  const exit = getTimeMazeExitIndex(question);
  const queue: number[] = [start];
  const previous = new Map<number, number | null>([[start, null]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor];
    if (position === exit) break;
    for (const direction of MAZE_DIRECTIONS) {
      const neighbor = getTimeMazeNeighbor(question, position, direction);
      if (neighbor === null || previous.has(neighbor)) continue;
      previous.set(neighbor, position);
      queue.push(neighbor);
    }
  }

  if (!previous.has(exit)) return null;
  const path: number[] = [];
  let position: number | null = exit;
  while (position !== null) {
    path.push(position);
    position = previous.get(position) ?? null;
  }
  return path.reverse();
}

export function isValidTimeMazeConfiguration(question: TimeMazeQuestion) {
  return hasValidMazeShape(question) && findShortestTimeMazePath(question) !== null;
}

export function isValidTimeMazePath(question: TimeMazeQuestion, path: number[]) {
  if (!isValidTimeMazeConfiguration(question) || path.length === 0) return false;
  if (path[0] !== getTimeMazeStartIndex(question)) return false;
  const cellCount = question.cells.length;

  return path.every((position, index) => {
    if (!Number.isInteger(position) || position < 0 || position >= cellCount) return false;
    if (question.cells[position] === "wall") return false;
    if (index === 0) return true;
    const previous = path[index - 1];
    return MAZE_DIRECTIONS.some(
      (direction) => getTimeMazeNeighbor(question, previous, direction) === position,
    );
  });
}
