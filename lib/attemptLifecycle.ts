import type { AttemptLifecycle, AttemptOutcome, GameMode } from "@/types/domain";

export class InvalidAttemptLifecycleError extends Error {
  readonly code = "invalid_attempt_lifecycle";

  constructor() {
    super("invalid_attempt_lifecycle");
    this.name = "InvalidAttemptLifecycleError";
  }
}

export function isAttemptOutcomeForMode(mode: unknown, outcome: unknown): outcome is AttemptOutcome {
  switch (mode) {
    case "flash":
    case "alphabet":
    case "narrative":
      return outcome === null;
    case "survival":
      return outcome === null || outcome === "survived" || outcome === "eliminated";
    case "pyramid":
      return outcome === null || outcome === "summit" || outcome === "failed";
    default:
      return false;
  }
}

export function isValidAttemptLifecycle(value: unknown): value is AttemptLifecycle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { challengeMode, status, outcome } = value as Record<string, unknown>;
  if (!isAttemptOutcomeForMode(challengeMode, outcome)) return false;
  switch (status) {
    case "in_progress":
    case "abandoned":
      return outcome === null;
    case "completed":
      return challengeMode === "survival" || challengeMode === "pyramid"
        ? outcome !== null
        : outcome === null;
    case "invalidated":
      return true;
    default:
      return false;
  }
}

export function assertAttemptLifecycle(value: unknown): asserts value is AttemptLifecycle {
  if (!isValidAttemptLifecycle(value)) throw new InvalidAttemptLifecycleError();
}

/** Recovery hints describe evaluated progress before the terminal transaction commits. */
export function isValidTerminalOutcomeHint(mode: GameMode, outcome: unknown): boolean {
  return isAttemptOutcomeForMode(mode, outcome);
}
