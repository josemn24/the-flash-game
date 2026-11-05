import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidQueensConfiguration, countQueensSolutions } from "../../../lib/queens.ts";
import { isValidConnectPairsConfiguration } from "../../../lib/connectPairs.ts";
import { parseFlashEditorialDocument } from "../../../lib/editorial/flashDocument.ts";
import { BETA_VIP_TIME_TRIAL, betaVipTimeTrialQuestions } from "./betavip-time-trial.mjs";
import { BETA_VIP_CONNECT_PAIRS, betaVipConnectPairsQuestions } from "./betavip-connect-pairs.mjs";
import { TABARNIA_QUEENS_TIME_TRIAL } from "./tabarnia-time-trial-queens.mjs";
import { TABARNIA_CONNECT_PAIRS_TIME_TRIAL } from "./tabarnia-time-trial-connect-pairs.mjs";

const sequences = [
  {
    name: "BetaVIP Queens",
    challenge: BETA_VIP_TIME_TRIAL,
    questions: betaVipTimeTrialQuestions,
    originalFingerprint: "e2757ceb3a2abee25f931381f9ca8a7ef915a34da83333637afa429fb1c09d56",
  },
  {
    name: "BetaVIP Connect Pairs",
    challenge: BETA_VIP_CONNECT_PAIRS,
    questions: betaVipConnectPairsQuestions,
    originalFingerprint: "2cff251d1b7ddd144e385314a2e662a6498a7ecf1b4029e4b8bab6580820e300",
  },
  ...[TABARNIA_QUEENS_TIME_TRIAL, TABARNIA_CONNECT_PAIRS_TIME_TRIAL].map((sequence, index) => ({
    name: index === 0 ? "Tabarnia Queens" : "Tabarnia Connect Pairs",
    challenge: sequence.challenge,
    questions: sequence.questions.map((question, position) => ({
      ...question,
      points: sequence.challenge.items[position].points,
    })),
    originalFingerprint:
      index === 0
        ? "d1bcf79bdd1529a68d4abdc2e989a0d83abd7812202005bc231514f3a49ce4fb"
        : "c7681a114f514b336ff2c7513543be68abe96da36fa3be3d526183468fde1224",
  })),
];

describe.each(sequences)("$name", ({ challenge, questions, originalFingerprint }) => {
  it("publishes seven boards with the agreed clock, sequence and scoring", () => {
    const metadata = { ...challenge };
    delete metadata.items;
    expect(
      parseFlashEditorialDocument({
        challenge: { ...metadata, mode: "time-trial", configSchemaVersion: 1, modeConfig: {} },
        questions,
      }).questions,
    ).toHaveLength(7);
    expect(challenge.globalTimeLimitMs).toBe(150_000);
    expect(questions.map((q) => q.publicPayload.grid.rows)).toEqual([4, 4, 5, 5, 6, 6, 7]);
    expect(questions.map((q) => q.points)).toEqual([12, 13, 13, 14, 15, 16, 17]);
    expect(
      questions.map((_, index) =>
        questions.slice(0, index + 1).reduce((sum, q) => sum + q.points, 0),
      ),
    ).toEqual([12, 25, 38, 52, 67, 83, 100]);
    expect(new Set(questions.map((q) => q.slug)).size).toBe(7);
    questions.forEach((q, index) => {
      expect(q.publicPayload.question).toContain(`Tablero ${index + 1} de 7`);
      expect(JSON.stringify(q.publicPayload)).not.toMatch(/solution|explanation/i);
    });
  });

  it("preserves the identities, layouts, hints, colors, solutions and order of the six previous boards", () => {
    // Frozen before inserting the intro; weights and display numbering intentionally change.
    const previousBoards = questions.slice(1).map(({ slug, publicPayload, solutionPayload }) => ({
      slug,
      publicPayload: Object.fromEntries(
        Object.entries(publicPayload).filter(([key]) => key !== "question"),
      ),
      solutionPayload,
    }));
    expect(createHash("sha256").update(JSON.stringify(previousBoards)).digest("hex")).toBe(
      originalFingerprint,
    );
  });

  it("starts with a short independent introduction", () => {
    const intro = questions[0];
    expect(intro.slug).toMatch(/intro-4x4$/);
    if (intro.type === "queens") {
      expect(intro.publicPayload.prefilledQueens).toHaveLength(2);
      expect(
        intro.solutionPayload.solution.filter(
          (cell) => !intro.publicPayload.prefilledQueens.includes(cell),
        ),
      ).toHaveLength(2);
    } else {
      expect(intro.publicPayload.pairs.map((pair) => pair.id)).toEqual(["a", "b", "c", "d"]);
      expect(Object.values(intro.solutionPayload.paths).map((path) => path.length)).toEqual([
        4, 4, 4, 4,
      ]);
      expect(intro.publicPayload.pairs.every((pair) => pair.color === undefined)).toBe(true);
    }
  });

  it.each(questions)("$slug has valid complete content", (question) => {
    const { publicPayload, solutionPayload } = question;
    if (question.type === "queens") {
      const board = { ...publicPayload, solution: solutionPayload.solution };
      expect(isValidQueensConfiguration(board)).toBe(true);
      expect(countQueensSolutions(board)).toBe(1);
    } else {
      expect(
        isValidConnectPairsConfiguration({
          ...publicPayload,
          solutionPaths: solutionPayload.paths,
        }),
      ).toBe(true);
    }
  });
});
