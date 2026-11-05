import type { GameSessionFailure } from "@/types/contracts/game-session";
import type { GameMode } from "@/types/domain/content";
import { GAME_SESSION_ERROR_REASONS } from "@/lib/competitiveErrors";
import type { CommandOrigin } from "./runtime";
import type { Operation, SessionState } from "./sessionReducer";

const lifecycleOperations = new Set<Operation>([
  "start",
  "prepareSession",
  "recover",
  "prepare",
  "activate",
  "complete",
  "abandon",
  "alphabetPass",
  "queensDraft",
  "connectPairsDraft",
  "takeover",
]);
/** The engine owns counters and timers; this policy only describes the next wait. */
export function commandRetryPlan({
  operation,
  failure,
  definitive,
  automaticRetries,
  now,
  retryUntilAccepted = false,
}: {
  operation: Operation;
  failure?: GameSessionFailure;
  definitive: boolean;
  automaticRetries: number;
  now: number;
  retryUntilAccepted?: boolean;
}) {
  const seconds =
    failure?.retryAfterSeconds === undefined ? undefined : Math.max(1, failure.retryAfterSeconds);
  const retryable = !definitive && (!failure || failure.retryable);
  const limit =
    retryUntilAccepted || operation === "queensDraft" || operation === "connectPairsDraft"
      ? Number.POSITIVE_INFINITY
      : operation === "complete"
        ? 3
        : 1;
  const exponentialDelay = Math.min(30_000, 1_000 * 2 ** automaticRetries);
  return {
    retryable,
    limit,
    seconds,
    retryAt: seconds === undefined ? 0 : now + seconds * 1000,
    delayMs:
      retryable && automaticRetries < limit
        ? seconds === undefined
          ? exponentialDelay
          : seconds * 1000
        : undefined,
  };
}

export type FailureAction =
  | { type: "takeover-conflict" }
  | { type: "session-transferred" }
  | { type: "authorization-lost"; recoverTerminal: boolean }
  | { type: "expired" }
  | { type: "reload-projection"; automatic: boolean }
  | {
      type: "command-failed";
      definitive: boolean;
      lifecycle: boolean;
      retry: ReturnType<typeof commandRetryPlan>;
    };

/** Preserves precedence: transfer conflict, transfer loss, authorization, expiry, projection, input. */
export function classifyCommandFailure({
  operation,
  mode,
  failure,
  hasAttempt,
  terminalRecoveryAttempted,
  automaticRetries,
  now,
}: {
  operation: Operation;
  mode: GameMode;
  failure?: GameSessionFailure;
  hasAttempt: boolean;
  terminalRecoveryAttempted: boolean;
  automaticRetries: number;
  now: number;
}): { action: FailureAction; takeoverUncertain: boolean } {
  const code = failure?.code;
  const takeoverUncertain = operation === "takeover" && (!failure || failure.kind === "uncertain");
  const result = (action: FailureAction) => ({ action, takeoverUncertain });
  if (operation === "takeover" && (code === "stale_version" || code === "idempotency_conflict"))
    return { action: { type: "takeover-conflict" }, takeoverUncertain: false };
  if (code === "session_transferred") return result({ type: "session-transferred" });
  if (
    (failure && GAME_SESSION_ERROR_REASONS[failure.code] === "authorization") ||
    (failure?.authorizationLost && code !== "attempt_session_missing")
  )
    return result({
      type: "authorization-lost",
      recoverTerminal: !terminalRecoveryAttempted && operation !== "recover" && hasAttempt,
    });
  if (code === "attempt_inactivity_expired") return result({ type: "expired" });
  if (
    ["complete", "recover", "start", "prepareSession"].includes(operation) &&
    (code === "attempt_session_missing" || code === "attempt_terminal")
  )
    return result({
      type: "reload-projection",
      automatic: true,
    });
  if (
    code === "unknown_rejection" ||
    (failure?.kind === "rejected" &&
      operation === "complete" &&
      (code === "survival_not_terminal" || code === "pyramid_not_terminal"))
  )
    return result({ type: "reload-projection", automatic: false });
  const definitive =
    failure?.kind === "rejected" &&
    (GAME_SESSION_ERROR_REASONS[failure.code] === "input" || code === "takeover_not_prepared");
  const retry = commandRetryPlan({
    operation,
    failure,
    definitive,
    automaticRetries,
    now,
  });
  return result({
    type: "command-failed",
    definitive,
    lifecycle:
      !definitive ||
      lifecycleOperations.has(operation) ||
      code === "stale_version" ||
      mode === "alphabet",
    retry,
  });
}

export function afterCommandRecovery({
  origin,
  accepted,
  code,
  reconciling,
}: {
  origin: CommandOrigin;
  accepted: boolean;
  code?: string;
  reconciling: boolean;
}): "reconcile" | "continue" {
  return origin !== "takeover" &&
    !accepted &&
    code === "stale_version" &&
    (origin === "retry" || !reconciling)
    ? "reconcile"
    : "continue";
}

export function retryReaction(
  state: SessionState,
): "reload-result" | "refresh" | "reconcile" | "replay" {
  if (state.lifecycleError?.operation === "projection")
    return state.lifecycleError.code === "review_pending" && state.attempt
      ? "reload-result"
      : "refresh";
  return state.lifecycleError?.code === "stale_version" ? "reconcile" : "replay";
}
