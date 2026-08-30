import { describe, expect, it } from "vitest";
import {
  applyEscapeMove,
  getEscapeLegalDestinations,
  isEscapeSolved,
  isValidEscapeConfiguration,
  replayEscapeMoves,
  reverseEscapeMove,
} from "@/lib/escape";
import type { EscapeQuestion } from "@/types/game";

const question: EscapeQuestion = {
  id: "escape-test",
  type: "escape",
  category: "Lógica",
  tags: {
    domains: ["mathematics"],
    topics: ["spatial_logic_puzzles"],
    cognitiveSkills: ["problem_solving"],
    formatSkills: ["planning"],
  },
  question: "Libera el bloque amarillo.",
  timeLimit: 45,
  points: 150,
  explanation: "Despeja la salida.",
  grid: { rows: 6, columns: 6, exit: { side: "right", row: 2 } },
  initialBlocks: [
    { id: "target", kind: "target", orientation: "horizontal", row: 2, column: 0, length: 2 },
    { id: "a", kind: "obstacle", orientation: "vertical", row: 1, column: 2, length: 2 },
    { id: "b", kind: "obstacle", orientation: "vertical", row: 0, column: 4, length: 3 },
    { id: "c", kind: "obstacle", orientation: "horizontal", row: 0, column: 1, length: 2 },
    { id: "d", kind: "obstacle", orientation: "horizontal", row: 4, column: 1, length: 2 },
  ],
  referenceSolution: [
    { blockId: "c", from: 1, to: 0 },
    { blockId: "a", from: 1, to: 0 },
    { blockId: "b", from: 0, to: 3 },
    { blockId: "target", from: 0, to: 4 },
  ],
  optimalMoves: 4,
};

describe("escape", () => {
  it("accepts the demo configuration and solves its reference sequence", () => {
    expect(isValidEscapeConfiguration(question)).toBe(true);
    const replay = replayEscapeMoves(question, question.referenceSolution);
    expect(replay).toMatchObject({ valid: true, appliedMoves: 4, escaped: true });
    expect(isEscapeSolved(question, replay.blocks)).toBe(true);
  });

  it("finds intermediate and multi-cell destinations without crossing blockers", () => {
    expect(getEscapeLegalDestinations(question, question.initialBlocks, "b")).toEqual([1, 2, 3]);
    expect(getEscapeLegalDestinations(question, question.initialBlocks, "target")).toEqual([]);
    expect(getEscapeLegalDestinations(question, question.initialBlocks, "a")).toEqual([2]);
  });

  it("applies and reverses a legal movement", () => {
    const moved = applyEscapeMove(question, question.initialBlocks, {
      blockId: "c",
      from: 1,
      to: 0,
    });
    expect(moved?.find((block) => block.id === "c")?.column).toBe(0);
    expect(moved && reverseEscapeMove(question, moved, question.referenceSolution[0])).toEqual(
      question.initialBlocks,
    );
  });

  it("rejects stale origins, unknown blocks, collisions and jumps", () => {
    expect(
      applyEscapeMove(question, question.initialBlocks, { blockId: "c", from: 0, to: 1 }),
    ).toBeNull();
    expect(
      applyEscapeMove(question, question.initialBlocks, { blockId: "missing", from: 0, to: 1 }),
    ).toBeNull();
    expect(
      applyEscapeMove(question, question.initialBlocks, { blockId: "a", from: 1, to: 0 }),
    ).toBeNull();
    expect(
      applyEscapeMove(question, question.initialBlocks, { blockId: "target", from: 0, to: 4 }),
    ).toBeNull();
  });

  it("stops replay at the first manipulated movement", () => {
    const replay = replayEscapeMoves(question, [
      question.referenceSolution[0],
      { blockId: "a", from: 2, to: 0 },
    ]);
    expect(replay).toMatchObject({ valid: false, appliedMoves: 1, escaped: false, errorIndex: 1 });
  });

  it.each([
    ["without a target", question.initialBlocks.filter((block) => block.kind !== "target")],
    [
      "with duplicate targets",
      [...question.initialBlocks, { ...question.initialBlocks[0], id: "target-2", row: 3 }],
    ],
    [
      "with duplicate ids",
      question.initialBlocks.map((block, index) =>
        index === 1 ? { ...block, id: "target" } : block,
      ),
    ],
    [
      "with an out-of-bounds block",
      question.initialBlocks.map((block, index) => (index === 4 ? { ...block, column: 5 } : block)),
    ],
    [
      "with overlapping blocks",
      question.initialBlocks.map((block, index) =>
        index === 4 ? { ...block, row: 2, column: 0 } : block,
      ),
    ],
  ])("rejects configurations %s", (_label, initialBlocks) => {
    expect(isValidEscapeConfiguration({ ...question, initialBlocks } as EscapeQuestion)).toBe(
      false,
    );
  });

  it("rejects a misaligned or initially solved target", () => {
    expect(
      isValidEscapeConfiguration({
        ...question,
        grid: { ...question.grid, exit: { side: "right", row: 3 } },
      }),
    ).toBe(false);
    expect(
      isValidEscapeConfiguration({
        ...question,
        initialBlocks: question.initialBlocks.map((block) =>
          block.kind === "target"
            ? { ...block, column: 4 }
            : block.id === "b"
              ? { ...block, row: 3 }
              : block,
        ),
      }),
    ).toBe(false);
  });
});
