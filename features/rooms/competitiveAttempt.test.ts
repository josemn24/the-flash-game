import { describe, expect, it } from "vitest";
import { getCompetitiveAttemptStatus } from "./competitiveAttempt";

describe("competitive attempt status", () => {
  it("maps the lifecycle to the visible room states", () => {
    expect(getCompetitiveAttemptStatus([])).toBe("available");
    expect(getCompetitiveAttemptStatus([{ status: "in_progress", outcome: null }])).toBe(
      "inProgress",
    );
    expect(getCompetitiveAttemptStatus([{ status: "completed", outcome: "passed" }])).toBe(
      "completed",
    );
    expect(getCompetitiveAttemptStatus([{ status: "completed", outcome: "failed" }])).toBe(
      "notCompleted",
    );
    expect(getCompetitiveAttemptStatus([{ status: "invalidated", outcome: null }])).toBe(
      "notCompleted",
    );
  });
});
