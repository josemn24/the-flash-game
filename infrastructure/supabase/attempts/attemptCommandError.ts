export class AttemptCommandError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(code: string, cause?: unknown) {
    super(code, { cause });
    this.name = "AttemptCommandError";
    this.code = code;
    if (
      code === "alphabet_deadline_not_reached" &&
      cause &&
      typeof cause === "object" &&
      "detail" in cause
    ) {
      try {
        const detail = JSON.parse(String(cause.detail)) as { retryAfterSeconds?: unknown };
        const seconds = Number(detail.retryAfterSeconds);
        if (Number.isSafeInteger(seconds) && seconds > 0) this.retryAfterSeconds = seconds;
      } catch {
        // Malformed diagnostics must never replace the original database error.
      }
    }
  }
}
