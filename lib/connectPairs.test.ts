import { describe, expect, it } from "vitest";
import { questionsById } from "@/test-utils/mockGameplay";
import {
  applyConnectPairsCellSelection,
  calculateConnectPairsMetrics,
  connectPairsRoutePoints,
  isValidConnectPairsConfiguration,
  isRestorableConnectPairsDraft,
  startConnectPairsDrag,
} from "@/lib/connectPairs";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import type { ConnectPairsQuestion } from "@/types/gameplay/scoring";
import rehearsalConnectPairs from "@/data/rehearsals/bank/connect-pairs.json";

const question = questionsById["pyramid-connect-pairs-trap"];
const example = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;

function squareQuestion(size: number, pairCount = size): ConnectPairsQuestion {
  const groupSizes = Array.from(
    { length: pairCount },
    (_, index) => Math.floor(size / pairCount) + (index < size % pairCount ? 1 : 0),
  );
  let firstRow = 0;
  const pairs = groupSizes.map((rowCount, index) => {
    const path = Array.from({ length: rowCount * size }, (_, offset) => {
      const row = firstRow + Math.floor(offset / size);
      const columnInRow = offset % size;
      const column = Math.floor(offset / size) % 2 === 0 ? columnInRow : size - 1 - columnInRow;
      return row * size + column;
    });
    firstRow += rowCount;
    return {
      id: `pair-${index + 1}`,
      label: `Pareja ${index + 1}`,
      symbol: String(index + 1),
      endpoints: [path[0], path.at(-1)!] as [number, number],
      path,
    };
  });

  return {
    id: `connect-pairs-${size}-${pairCount}`,
    type: "connect-pairs",
    category: "test",
    tags: { domains: [], topics: [], cognitiveSkills: [], formatSkills: [] },
    question: "Conecta todas las parejas y cubre el tablero.",
    questionContext: "",
    timeLimit: 1,
    points: 100,
    grid: { rows: size, columns: size } as ConnectPairsQuestion["grid"],
    pairs: pairs.map(({ id, label, symbol, endpoints }) => ({ id, label, symbol, endpoints })),
    solutionPaths: Object.fromEntries(pairs.map(({ id, path }) => [id, path])),
    requireFullCoverage: true,
    explanation: "",
  };
}

type ConnectPairsBoard = {
  grid: { rows: number; columns: number };
  pairs: { id: string; endpoints: [number, number] }[];
};

function countFullCoverageSolutions(board: ConnectPairsBoard, limit = 2) {
  const { rows, columns } = board.grid;
  const cellCount = rows * columns;
  const used = Array<boolean>(cellCount).fill(false);
  const endpointPair = Array<number>(cellCount).fill(-1);
  const neighbors = Array.from({ length: cellCount }, (_, cell) => {
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    return [
      row > 0 ? cell - columns : -1,
      row + 1 < rows ? cell + columns : -1,
      column > 0 ? cell - 1 : -1,
      column + 1 < columns ? cell + 1 : -1,
    ].filter((neighbor) => neighbor >= 0);
  });

  board.pairs.forEach(({ endpoints }, pairIndex) => {
    for (const endpoint of endpoints) {
      if (endpoint < 0 || endpoint >= cellCount || endpointPair[endpoint] !== -1)
        throw new Error("Invalid connect-pairs endpoints");
      endpointPair[endpoint] = pairIndex;
    }
  });

  function regionsCanStillBeCovered(pairIndex: number, current: number, target: number) {
    const seen = Array<boolean>(cellCount).fill(false);

    // Each free region must contain complete endpoint pairs; the active route must reach its target region.
    for (let start = 0; start < cellCount; start++) {
      if (used[start] || seen[start]) continue;
      const region = [start];
      seen[start] = true;
      let endpoints = 0;
      let hasTarget = false;
      let regionTouchesPath = false;

      for (let index = 0; index < region.length; index++) {
        const cell = region[index]!;
        if (neighbors[current]!.includes(cell)) regionTouchesPath = true;
        if (endpointPair[cell] !== -1) {
          endpoints++;
          if (cell === target) hasTarget = true;
          else if (endpointPair[cell] === pairIndex) return false;
        }
        for (const neighbor of neighbors[cell]!) {
          if (!used[neighbor] && !seen[neighbor]) {
            seen[neighbor] = true;
            region.push(neighbor);
          }
        }
      }

      if (hasTarget) {
        if (!regionTouchesPath || endpoints < 1 || (endpoints - 1) % 2 !== 0) return false;
      } else if (endpoints < 2 || endpoints % 2 !== 0) {
        return false;
      }
    }
    return true;
  }

  function assignPair(pairIndex: number): number {
    if (pairIndex === board.pairs.length) return used.every(Boolean) ? 1 : 0;

    const [start, target] = board.pairs[pairIndex]!.endpoints;
    if (used[start] || used[target]) return 0;
    used[start] = true;

    function extend(current: number): number {
      if (!regionsCanStillBeCovered(pairIndex, current, target)) return 0;
      let solutions = 0;

      for (const next of neighbors[current]!) {
        if (used[next]) continue;
        const endpointOwner = endpointPair[next]!;
        if (endpointOwner !== -1 && next !== target) continue;

        used[next] = true;
        if (next === target) solutions += assignPair(pairIndex + 1);
        else solutions += extend(next);
        used[next] = false;
        if (solutions >= limit) return limit;
      }
      return solutions;
    }

    const solutions = extend(start);
    used[start] = false;
    return solutions;
  }

  return assignPair(0);
}

function assertSolutionCoversBoard(board: ConnectPairsBoard, paths: Record<string, number[]>) {
  const cellCount = board.grid.rows * board.grid.columns;
  const seen = new Set<number>();
  for (const [pair, path] of Object.entries(paths)) {
    const matchedPair = board.pairs.find(
      ({ id, endpoints }) =>
        id === pair &&
        ((path[0] === endpoints[0] && path.at(-1) === endpoints[1]) ||
          (path[0] === endpoints[1] && path.at(-1) === endpoints[0])),
    );
    expect(matchedPair, pair).toBeDefined();
    expect(path.length).toBeGreaterThanOrEqual(2);
    for (const [index, cell] of path.entries()) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(cellCount);
      expect(seen.has(cell), `overlapping cell ${cell}`).toBe(false);
      seen.add(cell);
      if (index > 0)
        expect(neighborsAreAdjacent(path[index - 1]!, cell, board.grid.columns)).toBe(true);
    }
  }
  expect(Object.keys(paths)).toHaveLength(board.pairs.length);
  expect(seen.size).toBe(cellCount);
}

function neighborsAreAdjacent(first: number, second: number, columns: number) {
  return (
    Math.abs(Math.floor(first / columns) - Math.floor(second / columns)) +
      Math.abs((first % columns) - (second % columns)) ===
    1
  );
}

describe("Connect pairs authored solution uniqueness", () => {
  const spiralQuestion = questionsById["pyramid-connect-pairs-spiral"];
  const previousBoard = rehearsalConnectPairs.find(
    (entry) => entry.id === "bank-parejas-cumbre-anterior",
  )!;

  it.each([
    ["Cumbre lógica 6×6", spiralQuestion, spiralQuestion.solutionPaths],
    ["variante editorial 5×5", previousBoard.publicPayload, previousBoard.solutionPayload.paths],
  ])(
    "exhaustively validates the %s solution",
    (_label, untypedBoard, solutionPaths) => {
      const board = untypedBoard as ConnectPairsBoard;
      assertSolutionCoversBoard(board, solutionPaths as Record<string, number[]>);
      expect(countFullCoverageSolutions(board)).toBe(1);
    },
    30000,
  );
});

describe("Connect pairs square board sizes", () => {
  it.each([4, 5, 6, 7, 8])("validates a %i×%i board at the pair limit", (size) => {
    const question = squareQuestion(size);
    const metrics = calculateConnectPairsMetrics(question, { paths: question.solutionPaths });

    expect(isValidConnectPairsConfiguration(question)).toBe(true);
    expect(metrics).toMatchObject({ valid: true, exact: true, totalCells: size * size });
    expect(question.pairs.at(-1)?.endpoints).toContain(size * size - 1);
    expect(connectPairsRoutePoints([size * size - 1], question.grid)).toBe(
      `${size - 0.5},${size - 0.5}`,
    );
  });

  it.each([4, 5, 6, 7, 8])("accepts the minimum three pairs on %i×%i", (size) => {
    const question = squareQuestion(size, 3);
    expect(isValidConnectPairsConfiguration(question)).toBe(true);
  });

  it("rejects rectangular, out-of-range, over-paired and out-of-bounds questions", () => {
    const question = squareQuestion(4);
    const rectangular = {
      ...question,
      grid: { rows: 4, columns: 5 },
    } as unknown as ConnectPairsQuestion;
    const tooSmall = {
      ...question,
      grid: { rows: 3, columns: 3 },
    } as unknown as ConnectPairsQuestion;
    const tooLarge = {
      ...question,
      grid: { rows: 9, columns: 9 },
    } as unknown as ConnectPairsQuestion;
    const tooManyPairs = {
      ...question,
      pairs: [
        ...question.pairs,
        { id: "extra", label: "Extra", symbol: "X", endpoints: [1, 2] as const },
      ],
    };
    const outOfBounds = {
      ...question,
      solutionPaths: { ...question.solutionPaths, "pair-4": [12, 13, 14, 16] },
    };

    expect(isValidConnectPairsConfiguration(rectangular)).toBe(false);
    expect(isValidConnectPairsConfiguration(tooSmall)).toBe(false);
    expect(isValidConnectPairsConfiguration(tooLarge)).toBe(false);
    expect(isValidConnectPairsConfiguration(tooManyPairs)).toBe(false);
    expect(isValidConnectPairsConfiguration(outOfBounds)).toBe(false);
  });

  it("rejects crossed and repeated cells on the larger boards", () => {
    const question = squareQuestion(8);
    const repeated = {
      paths: { ...question.solutionPaths, "pair-1": [0, 1, 0, 1, 2, 3, 4, 5, 6, 7] },
    };
    const overlapping = {
      paths: {
        ...question.solutionPaths,
        "pair-1": [0, 1, 2, 3, 4, 5, 6, 7],
        "pair-2": [8, 9, 10, 11, 12, 13, 14, 15, 7],
      },
    };

    expect(calculateConnectPairsMetrics(question, repeated).valid).toBe(false);
    expect(calculateConnectPairsMetrics(question, overlapping).valid).toBe(false);
  });
});

describe("Connect pairs draft restoration", () => {
  it("accepts empty, partial and complete paths produced by the board", () => {
    expect(isRestorableConnectPairsDraft(question, { paths: {} })).toBe(true);
    expect(
      isRestorableConnectPairsDraft(question, {
        paths: { circle: [0, 1, 2], triangle: [8, 7] },
      }),
    ).toBe(true);
    expect(isRestorableConnectPairsDraft(question, { paths: question.solutionPaths })).toBe(true);
  });

  it.each([0, 9])(
    "restores a single endpoint at cell %i alongside a completed route",
    (endpoint) => {
      if (question.type !== "connect-pairs") throw new Error("Expected connect-pairs");
      expect(
        isRestorableConnectPairsDraft(question, {
          paths: { circle: [endpoint], triangle: question.solutionPaths.triangle },
        }),
      ).toBe(true);
    },
  );

  it("rejects incompatible, malformed and overlapping persisted paths", () => {
    expect(isRestorableConnectPairsDraft(question, { paths: { unknown: [0, 1] } })).toBe(false);
    expect(isRestorableConnectPairsDraft(question, { paths: { circle: [0, 2] } })).toBe(false);
    expect(isRestorableConnectPairsDraft(question, { paths: { circle: [0, 5, 10] } })).toBe(false);
    expect(isRestorableConnectPairsDraft(question, { paths: { circle: [0, 1, 26] } })).toBe(false);
    expect(
      isRestorableConnectPairsDraft(question, {
        paths: { circle: [0, 1, 2], triangle: [8, 7, 2] },
      }),
    ).toBe(false);
  });
});

describe("Connect pairs drag transitions", () => {
  it("starts from either endpoint and replaces an existing route", () => {
    const started = startConnectPairsDrag(example, { a: [0, 1, 2, 3, 4] }, 4);

    expect(started).toMatchObject({
      activePairId: "a",
      paths: { a: [4] },
      changed: true,
    });
  });

  it("keeps the last valid cell when a dragged cell is blocked", () => {
    let paths: Record<string, number[]> = {};
    let activePairId = "a";

    const start = startConnectPairsDrag(example, paths, 0, activePairId);
    paths = start.paths;
    activePairId = start.activePairId;

    const firstStep = applyConnectPairsCellSelection(example, paths, activePairId, 1);
    paths = firstStep.paths;
    activePairId = firstStep.activePairId;

    const blocked = applyConnectPairsCellSelection(example, paths, activePairId, 5);
    expect(blocked).toMatchObject({ paths: { a: [0, 1] }, changed: false });

    const resumed = applyConnectPairsCellSelection(example, paths, activePairId, 2);
    expect(resumed).toMatchObject({ paths: { a: [0, 1, 2] }, changed: true });
  });
});
