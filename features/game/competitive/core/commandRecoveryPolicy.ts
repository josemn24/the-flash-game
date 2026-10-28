import type { GameSessionFailure } from "@/types/contracts/game-session";
import type { GameMode } from "@/types/domain/content";
import { formatFailure } from "../formats/failure";
import type { CommandOrigin } from "./runtime";
import type { FeedbackChannel, Operation, SessionState } from "./sessionReducer";

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
  "takeover",
]);
const authorizationCodes = new Set([
  "not_authorized",
  "session_revoked",
  "competitive_access_denied",
  "auth_required",
  "unauthorized",
  "attempt_permission_revoked",
]);

/** The engine owns counters and timers; this policy only describes the next wait. */
export function commandRetryPlan({
  operation,
  failure,
  definitive,
  automaticRetries,
  now,
}: {
  operation: Operation;
  failure?: GameSessionFailure;
  definitive: boolean;
  automaticRetries: number;
  now: number;
}) {
  const seconds =
    failure?.retryAfterSeconds === undefined ? undefined : Math.max(1, failure.retryAfterSeconds);
  const retryable = !definitive && (!failure || failure.retryable);
  const limit = operation === "complete" ? 3 : 1;
  return {
    retryable,
    limit,
    seconds,
    retryAt: seconds === undefined ? 0 : now + seconds * 1000,
    delayMs:
      retryable && automaticRetries < limit
        ? seconds === undefined
          ? 1000 * 2 ** automaticRetries
          : seconds * 1000
        : undefined,
  };
}

type FailureAction =
  | { type: "takeover-conflict" }
  | { type: "session-transferred" }
  | { type: "authorization-lost"; recoverTerminal: boolean }
  | { type: "expired" }
  | { type: "reload-projection"; message: string }
  | {
      type: "command-failed";
      definitive: boolean;
      lifecycle: boolean;
      message: string;
      feedback: ReturnType<typeof formatFailure>["feedback"];
      retry: ReturnType<typeof commandRetryPlan>;
    };

/** Preserves precedence: transfer conflict, transfer loss, authorization, expiry, projection, input. */
export function classifyCommandFailure({
  operation,
  mode,
  failure,
  channel,
  hasAttempt,
  terminalRecoveryAttempted,
  automaticRetries,
  now,
}: {
  operation: Operation;
  mode: GameMode;
  failure?: GameSessionFailure;
  channel?: FeedbackChannel;
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
    authorizationCodes.has(code ?? "") ||
    (failure?.authorizationLost && code !== "attempt_session_missing")
  )
    return result({
      type: "authorization-lost",
      recoverTerminal: !terminalRecoveryAttempted && operation !== "recover" && hasAttempt,
    });
  if (code === "attempt_inactivity_expired") return result({ type: "expired" });
  if (
    ["complete", "recover", "start"].includes(operation) &&
    (code === "attempt_session_missing" || code === "attempt_terminal")
  )
    return result({
      type: "reload-projection",
      message:
        operation === "start" && code === "attempt_session_missing"
          ? "Recarga la página para preparar la sesión antes de empezar."
          : "Comprobando el resultado guardado. Puedes volver a cargarlo.",
    });
  const formatted = formatFailure(operation, code, channel);
  const retry = commandRetryPlan({
    operation,
    failure,
    definitive: formatted.definitive,
    automaticRetries,
    now,
  });
  const message =
    retry.retryable && automaticRetries >= retry.limit
      ? "No hemos podido confirmar la operación"
      : code === "alphabet_deadline_not_reached" || code === "time_trial_not_terminal"
        ? "Esperando a que termine el tiempo de la partida."
        : retry.seconds !== undefined
          ? `Demasiadas solicitudes. Espera ${retry.seconds} ${retry.seconds === 1 ? "segundo" : "segundos"} antes de volver a intentarlo.`
          : formatted.message;
  return result({
    type: "command-failed",
    definitive: formatted.definitive,
    lifecycle:
      !formatted.definitive ||
      lifecycleOperations.has(operation) ||
      code === "stale_version" ||
      mode === "alphabet",
    message,
    feedback: formatted.feedback ? { ...formatted.feedback, message } : undefined,
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
