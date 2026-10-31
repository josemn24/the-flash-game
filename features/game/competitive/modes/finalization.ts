import type { CommandOrigin } from "../core/runtime";
import type { Operation, SessionState } from "../core/sessionReducer";

export type FinalizationCheckpoint =
  "before-after" | "after-after" | "after-finalize" | "after-reconcile";
export type FinalizationContext = {
  origin: CommandOrigin;
  operation: Operation;
  accepted: boolean;
  state: SessionState;
  requested: boolean;
  reconciling: boolean;
  expiredPass: boolean;
};
export type FinalizationDecision =
  | { type: "continue" }
  | { type: "finalize"; clearPending?: boolean }
  | { type: "reconcile"; resetRetryDelay: true };
export type FinalizationPolicy = {
  globalClock: boolean;
  recoveryDeadline: "response" | "session";
  onProgress: (requested: boolean, timedOut?: boolean) => "finalize" | "continue";
  onTimeout: (state: SessionState) => "finalize" | "question" | "ignore";
  onFailure: (operation: Operation, code: string | undefined) => "expired-pass" | "continue";
  afterCommand: (
    checkpoint: FinalizationCheckpoint,
    context: FinalizationContext,
  ) => FinalizationDecision;
};

const proceed = { type: "continue" } as const;
export const questionFinalization: FinalizationPolicy = {
  globalClock: false,
  recoveryDeadline: "response",
  onProgress: () => "continue",
  onTimeout: () => "question",
  onFailure: () => "continue",
  afterCommand: () => proceed,
};

const globalProgress: FinalizationPolicy["onProgress"] = (requested, timedOut = false) =>
  requested || timedOut ? "finalize" : "continue";

export const alphabetFinalization: FinalizationPolicy = {
  ...questionFinalization,
  globalClock: true,
  onProgress: globalProgress,
  onTimeout: (state) =>
    state.question && (state.phase === "playing" || state.phase === "checking")
      ? "finalize"
      : "ignore",
  onFailure: (operation, code) =>
    operation === "alphabetPass" && code === "pass_unavailable" ? "expired-pass" : "continue",
  afterCommand: (checkpoint, context) => {
    const { origin, operation, accepted, requested, reconciling, state, expiredPass } = context;
    if (checkpoint === "before-after" && origin !== "takeover" && !accepted && expiredPass)
      return { type: "finalize" };
    if (
      checkpoint === "after-reconcile" &&
      origin === "run" &&
      !accepted &&
      requested &&
      ["answer", "alphabetPass", "prepare"].includes(operation) &&
      !reconciling &&
      state.pendingCommand
    )
      // A rejected player action must not hold closing behind the interactive limiter.
      return { type: "reconcile", resetRetryDelay: true };
    return proceed;
  },
};

export const timeTrialFinalization: FinalizationPolicy = {
  ...questionFinalization,
  globalClock: true,
  recoveryDeadline: "session",
  onProgress: globalProgress,
  onTimeout: () => "finalize",
  afterCommand: (checkpoint, { origin, operation, accepted, requested, state }) => {
    if (
      checkpoint === "after-after" &&
      (origin === "takeover" || (operation !== "complete" && operation !== "recover")) &&
      operation !== "queensDraft" &&
      operation !== "connectPairsDraft" &&
      requested
    )
      return { type: "finalize" };
    if (
      checkpoint === "after-finalize" &&
      !accepted &&
      ["deadline_reached", "time_trial_terminal"].includes(state.lifecycleError?.code ?? "")
    )
      return { type: "finalize", clearPending: true };
    return proceed;
  },
};
