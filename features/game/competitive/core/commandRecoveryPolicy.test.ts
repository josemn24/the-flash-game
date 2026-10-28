import { describe, expect, it } from "vitest";
import type { GameSessionFailure } from "@/types/contracts/game-session";
import {
  afterCommandRecovery,
  classifyCommandFailure,
  commandRetryPlan,
  retryReaction,
} from "./commandRecoveryPolicy";
import { initialSessionState } from "./sessionReducer";

const base = {
  operation: "answer" as const,
  mode: "flash" as const,
  hasAttempt: true,
  terminalRecoveryAttempted: false,
  automaticRetries: 0,
  now: 1000,
};
const uncertain: GameSessionFailure = { kind: "uncertain", code: "offline", retryable: true };

describe("recovery precedence", () => {
  it.each(["stale_version", "idempotency_conflict"])(
    "transfer conflict %s wins over authorization metadata",
    (code) => {
      expect(
        classifyCommandFailure({
          ...base,
          operation: "takeover",
          failure: {
            kind: "rejected",
            code,
            retryable: true,
            authorizationLost: true,
          },
        }),
      ).toEqual({ action: { type: "takeover-conflict" }, takeoverUncertain: false });
    },
  );
  it("a transferred session never requests terminal recovery even if authorization metadata is set", () => {
    expect(
      classifyCommandFailure({
        ...base,
        failure: {
          kind: "rejected",
          code: "session_transferred",
          retryable: true,
          authorizationLost: true,
        },
      }).action,
    ).toEqual({ type: "session-transferred" });
  });
  it.each([
    {
      operation: "answer" as const,
      hasAttempt: true,
      terminalRecoveryAttempted: false,
      recoverTerminal: true,
    },
    {
      operation: "recover" as const,
      hasAttempt: true,
      terminalRecoveryAttempted: false,
      recoverTerminal: false,
    },
    {
      operation: "answer" as const,
      hasAttempt: true,
      terminalRecoveryAttempted: true,
      recoverTerminal: false,
    },
    {
      operation: "answer" as const,
      hasAttempt: false,
      terminalRecoveryAttempted: false,
      recoverTerminal: false,
    },
  ])(
    "bounds terminal recovery for $operation with attempt=$hasAttempt and tried=$terminalRecoveryAttempted",
    ({ recoverTerminal, ...context }) => {
      expect(
        classifyCommandFailure({
          ...base,
          ...context,
          failure: {
            kind: "rejected",
            code: "attempt_permission_revoked",
            retryable: false,
          },
        }).action,
      ).toEqual({ type: "authorization-lost", recoverTerminal });
    },
  );
  it("missing controller cookies reload terminal projection rather than retrying or revoking access", () => {
    expect(
      classifyCommandFailure({
        ...base,
        operation: "complete",
        failure: {
          kind: "rejected",
          code: "attempt_session_missing",
          retryable: false,
          authorizationLost: true,
        },
      }).action.type,
    ).toBe("reload-projection");
  });
  it("definitively rejected format input releases editing without a retry", () => {
    const { action } = classifyCommandFailure({
      ...base,
      operation: "miniWordleGuess",
      channel: "answerVerification",
      failure: {
        kind: "rejected",
        code: "invalid_mini_wordle_guess",
        retryable: true,
      },
    });
    expect(action).toMatchObject({
      type: "command-failed",
      definitive: true,
      lifecycle: false,
      retry: { retryable: false, delayMs: undefined },
    });
  });
});

describe("retry budget", () => {
  it.each([
    ["answer", 0, 1000],
    ["answer", 1, undefined],
    ["complete", 0, 1000],
    ["complete", 1, 2000],
    ["complete", 2, 4000],
    ["complete", 3, undefined],
  ] as const)("%s at retry %i waits %s milliseconds", (operation, automaticRetries, delayMs) => {
    expect(
      commandRetryPlan({
        operation,
        automaticRetries,
        failure: uncertain,
        definitive: false,
        now: 1000,
      }).delayMs,
    ).toBe(delayMs);
  });
  it.each([0, 1, 7])(
    "server retry delay %i overrides exponential backoff and is at least one second",
    (retryAfterSeconds) => {
      expect(
        commandRetryPlan({
          operation: "complete",
          automaticRetries: 2,
          failure: { ...uncertain, retryAfterSeconds },
          definitive: false,
          now: 1000,
        }),
      ).toMatchObject({
        delayMs: Math.max(1, retryAfterSeconds) * 1000,
        retryAt: 1000 + Math.max(1, retryAfterSeconds) * 1000,
      });
    },
  );
  it.each(["run", "retry", "takeover"] as const)(
    "%s preserves its stale-revision recovery boundary",
    (origin) => {
      expect(
        afterCommandRecovery({
          origin,
          accepted: false,
          code: "stale_version",
          reconciling: false,
        }),
      ).toBe(origin === "takeover" ? "continue" : "reconcile");
      expect(
        afterCommandRecovery({ origin, accepted: true, code: "stale_version", reconciling: false }),
      ).toBe("continue");
    },
  );
  it("a pending review reloads the result rather than replaying completion", () => {
    const state = initialSessionState("results");
    state.attempt = { id: "session", revision: 4 };
    state.lifecycleError = { operation: "projection", code: "review_pending", message: "pending" };
    expect(retryReaction(state)).toBe("reload-result");
  });
});
