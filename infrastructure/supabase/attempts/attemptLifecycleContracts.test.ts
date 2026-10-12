import { describe, expect, it } from "vitest";
import {
  decodeAttemptRecoverySnapshot,
  decodeFinishAttemptResult,
  decodeSavedAttemptResult,
  decodeSavedAbandonedAttemptResult,
} from "./attemptLifecycleContracts";

const base = { attemptId: "attempt", lockVersion: 2, score: 0, status: "completed" };
const recovery = {
  ...base,
  challengeMode: "survival",
  status: "in_progress",
  outcome: null,
  scheduledChallengeId: "publication",
  hasStartedInteraction: true,
  allItemsResolved: false,
  answers: [],
  terminalOutcome: "eliminated",
};

describe("attempt lifecycle PostgreSQL contracts", () => {
  it.each([
    ["flash", null],
    ["alphabet", null],
    ["narrative", null],
    ["survival", "survived"],
    ["survival", "eliminated"],
    ["pyramid", "summit"],
    ["pyramid", "failed"],
  ])("decodes zero-point completion for %s / %s", (challengeMode, outcome) => {
    const value = { ...base, challengeMode, outcome };
    expect(decodeFinishAttemptResult(value)).toEqual(value);
    expect(
      decodeSavedAttemptResult({
        scheduledChallengeId: "publication",
        result: { ...value, answers: [] },
      })?.result.outcome,
    ).toBe(outcome);
  });

  it.each(["flash", "alphabet", "survival", "pyramid", "narrative"])(
    "retains explicit null when abandonment is read without a cookie (%s)",
    (challengeMode) => {
      const value = { ...base, challengeMode, status: "abandoned", score: null, outcome: null };
      expect(
        decodeSavedAbandonedAttemptResult({ scheduledChallengeId: "publication", result: value })
          ?.result,
      ).toEqual(value);
    },
  );

  it.each([
    {},
    { ...base, challengeMode: "flash" },
    { ...base, challengeMode: "survival", outcome: "passed" },
    { ...base, challengeMode: "survival", outcome: "failed" },
    { ...base, challengeMode: "pyramid", outcome: "survived" },
    { ...base, challengeMode: "survival", outcome: null },
    { ...base, challengeMode: "flash", outcome: "unknown", secret: "sensitive-payload" },
  ])("rejects malformed or legacy terminal JSON %# without leaking it", (value) => {
    expect(() => decodeFinishAttemptResult(value)).toThrow("invalid_attempt_lifecycle");
    try {
      decodeFinishAttemptResult(value);
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-payload");
    }
  });

  it("keeps derived elimination separate from the persisted active outcome", () => {
    expect(decodeAttemptRecoverySnapshot(recovery)).toMatchObject({
      status: "in_progress",
      outcome: null,
      terminalOutcome: "eliminated",
    });
    expect(() => decodeAttemptRecoverySnapshot({ ...recovery, outcome: "eliminated" })).toThrow(
      "invalid_attempt_lifecycle",
    );
    expect(() => decodeAttemptRecoverySnapshot({ ...recovery, terminalOutcome: "failed" })).toThrow(
      "invalid_attempt_lifecycle",
    );
  });
});
