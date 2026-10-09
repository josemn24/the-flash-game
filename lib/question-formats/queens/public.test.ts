import { describe, expect, it } from "vitest";
import { readPublic } from "./public";

const context = {
  id: "queens",
  timeLimitMs: 60_000,
  points: 19,
  payload: {
    question: "Coronas",
    grid: { rows: 4, columns: 4 },
    regions: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 2, 3, 3, 3, 2],
    prefilledQueens: [2],
  },
};
describe("Queens public attempt budget", () => {
  it("reads the server budget without exposing the solution", () => {
    const question = readPublic({
      ...context,
      mode: "pyramid",
      progress: {
        queens: [2],
        incorrectValidations: 2,
        maxIncorrectValidations: 3,
      },
    });
    expect(question.progress).toMatchObject({
      incorrectValidations: 2,
      maxIncorrectValidations: 3,
    });
    expect(question).not.toHaveProperty("solution");
  });
  it("keeps unlimited modes without a budget", () => {
    expect(readPublic(context).progress).toMatchObject({
      incorrectValidations: 0,
      maxIncorrectValidations: null,
    });
  });
  it.each([
    { incorrectValidations: -1, maxIncorrectValidations: 3 },
    { incorrectValidations: 1.5, maxIncorrectValidations: 3 },
    { incorrectValidations: 1, maxIncorrectValidations: 0 },
    { incorrectValidations: 1, maxIncorrectValidations: 4 },
  ])("rejects malformed budget %j", (progress) => {
    expect(() => readPublic({ ...context, progress })).toThrow("invalid_question_payload");
  });
});
