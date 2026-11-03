import { describe, expect, it } from "vitest";
import { calculateConnectPairsMetrics } from "../../../lib/connectPairs.ts";
import { parseFlashEditorialDocument } from "../../../lib/editorial/flashDocument.ts";
import { BETA_VIP_CONNECT_PAIRS, betaVipConnectPairsQuestions } from "./betavip-connect-pairs.mjs";

describe("BetaVIP Conectar parejas", () => {
  it("can publish the complete seven-board time trial through the editorial validator", () => {
    const document = {
      challenge: {
        ...BETA_VIP_CONNECT_PAIRS,
        mode: "time-trial",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: betaVipConnectPairsQuestions,
    };
    expect(parseFlashEditorialDocument(document).questions).toHaveLength(7);
    expect(betaVipConnectPairsQuestions.reduce((sum, question) => sum + question.points, 0)).toBe(
      100,
    );
  });

  it("uses the planned dimensions, pair counts, and point weights", () => {
    expect(
      betaVipConnectPairsQuestions.map((question) => [
        question.publicPayload.grid.rows,
        question.publicPayload.grid.columns,
        question.publicPayload.pairs.length,
        question.points,
      ]),
    ).toEqual([
      [4, 4, 4, 12],
      [4, 4, 3, 13],
      [5, 5, 5, 13],
      [5, 5, 4, 14],
      [6, 6, 6, 15],
      [6, 6, 5, 16],
      [7, 7, 7, 17],
    ]);
  });

  it.each(betaVipConnectPairsQuestions)(
    "$slug has a full legal solution and distinct endpoints",
    (item) => {
      const question = { ...item.publicPayload, solutionPaths: item.solutionPayload.paths };
      const metrics = calculateConnectPairsMetrics(question, { paths: question.solutionPaths });
      expect(metrics).toMatchObject({
        valid: true,
        complete: true,
        exact: true,
        conflicts: 0,
      });
      expect(metrics.coveredCells).toBe(question.grid.rows * question.grid.columns);
    },
  );
});
