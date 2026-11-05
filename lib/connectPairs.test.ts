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
