import {
  assertAttemptLifecycle,
  InvalidAttemptLifecycleError,
  isValidTerminalOutcomeHint,
} from "@/lib/attemptLifecycle";
import type {
  AttemptRecoverySnapshot,
  FinishAttemptResult,
  SavedAttemptResult,
  SavedAbandonedAttemptResult,
} from "@/types/contracts/attempts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireContract(condition: unknown): asserts condition {
  if (!condition) throw new InvalidAttemptLifecycleError();
}

function hasCommandIdentity(value: Record<string, unknown>) {
  return (
    typeof value.attemptId === "string" &&
    Number.isSafeInteger(value.lockVersion) &&
    Number(value.lockVersion) > 0
  );
}

/** PostgreSQL JSON is untrusted until its mode/status/outcome contract is checked. */
export function decodeFinishAttemptResult(value: unknown): FinishAttemptResult {
  requireContract(isRecord(value) && hasCommandIdentity(value));
  const row: Record<string, unknown> = value;
  assertAttemptLifecycle(value);
  requireContract(value.status === "completed" || value.status === "abandoned");
  requireContract(
    value.status === "abandoned"
      ? row.score === null
      : Number.isInteger(row.score) && Number(row.score) >= 0 && Number(row.score) <= 100,
  );
  return value as FinishAttemptResult;
}

export function decodeSavedAttemptResult(value: unknown): SavedAttemptResult | null {
  if (value === null) return null;
  requireContract(isRecord(value) && typeof value.scheduledChallengeId === "string");
  const result = decodeFinishAttemptResult(value.result);
  requireContract(result.status === "completed" && Array.isArray(result.answers));
  return value as SavedAttemptResult;
}

export function decodeSavedAbandonedAttemptResult(
  value: unknown,
): SavedAbandonedAttemptResult | null {
  if (value === null) return null;
  requireContract(isRecord(value) && typeof value.scheduledChallengeId === "string");
  const result = decodeFinishAttemptResult(value.result);
  requireContract(result.status === "abandoned");
  return value as SavedAbandonedAttemptResult;
}

export function decodeAttemptRecoverySnapshot(value: unknown): AttemptRecoverySnapshot {
  requireContract(isRecord(value) && hasCommandIdentity(value));
  const row: Record<string, unknown> = value;
  assertAttemptLifecycle(value);
  requireContract(
    typeof row.scheduledChallengeId === "string" &&
      typeof row.hasStartedInteraction === "boolean" &&
      typeof row.allItemsResolved === "boolean" &&
      Array.isArray(row.answers),
  );
  requireContract(
    row.terminalOutcome === undefined ||
      isValidTerminalOutcomeHint(value.challengeMode, row.terminalOutcome),
  );
  return value as AttemptRecoverySnapshot;
}
