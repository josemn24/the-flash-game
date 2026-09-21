import { describe, expect, it } from "vitest";
import {
  calculateResultAccuracy,
  formatResultTime,
  getAnswerResultAccuracyUnit,
  getResultProgress,
  normalizeResultScore,
} from "@/features/game/resultSummary";

describe("result summary helpers", () => {
  it("formats the common result time", () => {
    expect(formatResultTime(0)).toBe("0 s");
    expect(formatResultTime(77)).toBe("1 min 17 s");
    expect(formatResultTime(120)).toBe("2 min");
  });

  it("calculates accuracy over the units that were played", () => {
    expect(calculateResultAccuracy([])).toBe(0);
    expect(
      calculateResultAccuracy([
        { status: "correct" },
        { status: "correct" },
        { status: "incorrect" },
        { status: "unanswered" },
      ]),
    ).toBe(50);
    expect(calculateResultAccuracy([{ status: "correct" }, { status: "incorrect" }])).toBe(50);
  });

  it("uses normalized partial proximity and ignores missing partial metrics", () => {
    expect(
      calculateResultAccuracy([
        { status: "correct" },
        { status: "partial", precision: 0.5 },
        { status: "partial" },
      ]),
    ).toBe(50);
    expect(calculateResultAccuracy([{ status: "partial", precision: 2 }])).toBe(100);
    expect(calculateResultAccuracy([{ status: "partial", precision: -1 }])).toBe(0);
  });

  it("adapts the proximity fields exposed by result details", () => {
    expect(
      getAnswerResultAccuracyUnit({
        status: "partial",
        details: { type: "estimation", difference: 2, proximity: 0.8 },
      }),
    ).toEqual({ status: "partial", precision: 0.8 });
    expect(
      getAnswerResultAccuracyUnit({
        status: "partial",
        details: {
          type: "heat-map",
          selectedPoint: { x: 1, y: 1 },
          targetPoint: { x: 2, y: 2 },
          distance: 1,
          accuracy: 0.6,
        },
      }),
    ).toEqual({ status: "partial", precision: 0.6 });
    expect(
      getAnswerResultAccuracyUnit({
        status: "partial",
        details: { type: "logic-code", submittedCodes: [], incorrectAttempts: 1 },
      }),
    ).toEqual({ status: "partial" });
  });

  it("normalizes scores and progress independently from accuracy", () => {
    expect(normalizeResultScore(120, 100)).toBe(100);
    expect(normalizeResultScore(-5, 100)).toBe(0);
    expect(getResultProgress(25, 100)).toBe(25);
    expect(getResultProgress(120, 100)).toBe(100);
  });
});
