import { describe, expect, it } from "vitest";
import { questionsById } from "@/data/questions";
import {
  applyConnectPairsCellSelection,
  isRestorableConnectPairsDraft,
  startConnectPairsDrag,
} from "@/lib/connectPairs";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";

const question = questionsById["pyramid-connect-pairs-trap"];
const example = QUESTION_FORMAT_CATALOG["connect-pairs"].examples[0].question;

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
