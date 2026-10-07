import { describe, expect, it } from "vitest";
import {
  assertAttemptLifecycle,
  isValidAttemptLifecycle,
  isValidTerminalOutcomeHint,
} from "./attemptLifecycle";

const modes = ["flash", "alphabet", "narrative", "survival", "pyramid"] as const;
const statuses = ["in_progress", "completed", "abandoned", "invalidated"] as const;
const outcomes = [
  null,
  "survived",
  "eliminated",
  "summit",
  "failed",
  "passed",
  "in_progress",
  "unknown",
  undefined,
] as const;

describe("persisted attempt lifecycle", () => {
  for (const mode of modes) {
    for (const status of statuses) {
      it.each(outcomes)(`${mode}/${status}/%s validates the complete matrix`, (outcome) => {
        const terminal =
          mode === "survival"
            ? outcome === "survived" || outcome === "eliminated"
            : mode === "pyramid"
              ? outcome === "summit" || outcome === "failed"
              : outcome === null;
        const expected =
          status === "in_progress" || status === "abandoned"
            ? outcome === null
            : status === "invalidated"
              ? outcome === null || terminal
              : terminal;
        expect(isValidAttemptLifecycle({ challengeMode: mode, status, outcome })).toBe(expected);
      });
    }
  }
  it.each([
    null,
    [],
    {},
    { challengeMode: "unknown", status: "completed", outcome: null },
    { challengeMode: "flash", status: "paused", outcome: null },
  ])("rejects malformed contracts", (value) => {
    expect(() => assertAttemptLifecycle(value)).toThrow("invalid_attempt_lifecycle");
  });
  it("keeps an impending elimination separate from the persisted active lifecycle", () => {
    expect(
      isValidAttemptLifecycle({ challengeMode: "survival", status: "in_progress", outcome: null }),
    ).toBe(true);
    expect(isValidTerminalOutcomeHint("survival", "eliminated")).toBe(true);
    expect(isValidTerminalOutcomeHint("survival", "summit")).toBe(false);
  });
});
