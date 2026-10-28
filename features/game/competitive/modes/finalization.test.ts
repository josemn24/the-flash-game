import { describe, expect, it } from "vitest";
import { initialSessionState } from "../core/sessionReducer";
import {
  alphabetFinalization,
  questionFinalization,
  timeTrialFinalization,
  type FinalizationContext,
} from "./finalization";

function context(overrides: Partial<FinalizationContext> = {}): FinalizationContext {
  return {
    origin: "run",
    operation: "prepare",
    accepted: false,
    state: initialSessionState("finalizing"),
    requested: true,
    reconciling: false,
    expiredPass: false,
    ...overrides,
  };
}

describe("global closing policies", () => {
  it.each(["complete", "recover"] as const)(
    "Contrarreloj does not recursively close after %s",
    (operation) => {
      expect(timeTrialFinalization.afterCommand("after-after", context({ operation }))).toEqual({
        type: "continue",
      });
    },
  );
  it("Contrarreloj rereads a terminal error after a prior finalization effect", () => {
    const before = context();
    expect(timeTrialFinalization.afterCommand("after-finalize", before)).toEqual({
      type: "continue",
    });
    const after = context({
      state: {
        ...before.state,
        lifecycleError: { operation: "prepare", code: "deadline_reached", message: "expired" },
      },
    });
    expect(timeTrialFinalization.afterCommand("after-finalize", after)).toEqual({
      type: "finalize",
      clearPending: true,
    });
  });
  it("only initial Alphabet dispatch reconciles an uncertain player action while closing", () => {
    const state = initialSessionState("finalizing");
    state.pendingCommand = {
      operation: "prepare",
      input: { sessionId: "s", revision: 2, idempotencyKey: "prepare-key" },
    };
    for (const origin of ["run", "retry", "takeover"] as const) {
      expect(
        alphabetFinalization.afterCommand("after-reconcile", context({ state, origin })),
      ).toEqual(
        origin === "run" ? { type: "reconcile", resetRetryDelay: true } : { type: "continue" },
      );
    }
  });
  it("per-question modes never acquire global finalization behavior", () => {
    expect(questionFinalization.onProgress(true, true)).toBe("continue");
    expect(questionFinalization.onTimeout(initialSessionState("transition"))).toBe("question");
    expect(questionFinalization.afterCommand("after-after", context())).toEqual({
      type: "continue",
    });
  });
  it("Contrarreloj may expire between boards while Alphabet ignores a timeout without an active question", () => {
    const state = initialSessionState("transition");
    expect(timeTrialFinalization.onTimeout(state)).toBe("finalize");
    expect(alphabetFinalization.onTimeout(state)).toBe("ignore");
  });
});
