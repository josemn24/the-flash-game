import { describe, expect, it } from "vitest";
import { questionsById } from "@/data/questions";
import { isRestorableConnectPairsDraft } from "@/lib/connectPairs";

const question = questionsById["pyramid-connect-pairs-trap"];

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
