import { describe, expect, it } from "vitest";
import { calculateConnectPairsMetrics } from "../../../lib/connectPairs.ts";
import { parseFlashEditorialDocument } from "../../../lib/editorial/flashDocument.ts";
import { BETA_VIP_CONNECT_PAIRS, betaVipConnectPairsQuestions } from "./betavip-connect-pairs.mjs";

describe("BetaVIP Conectar parejas", () => {
  it("can publish the complete five-board time trial through the editorial validator", () => {
    const document = {
      challenge: {
        ...BETA_VIP_CONNECT_PAIRS,
        mode: "time-trial",
        configSchemaVersion: 1,
        modeConfig: {},
      },
      questions: betaVipConnectPairsQuestions,
    };
    expect(parseFlashEditorialDocument(document).questions).toHaveLength(5);
    expect(betaVipConnectPairsQuestions.reduce((sum, question) => sum + question.points, 0)).toBe(
      100,
    );
  });

  it.each(betaVipConnectPairsQuestions)(
    "$slug has a full legal solution and distinct endpoints",
    (item) => {
      const question = { ...item.publicPayload, solutionPaths: item.solutionPayload.paths };
      expect(
        calculateConnectPairsMetrics(question, { paths: question.solutionPaths }),
      ).toMatchObject({
        valid: true,
        complete: true,
        exact: true,
        coveredCells: 25,
        conflicts: 0,
      });
    },
  );
});
