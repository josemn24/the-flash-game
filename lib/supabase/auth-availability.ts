import {
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

export const AUTH_BUDGET_MS = 5_000;
export const AUTH_DEADLINE_HEADER = "x-flash-auth-deadline";
export const AUTH_FAILURE_HEADER = "x-flash-auth-failure";

export type AuthFailureReason = "connection" | "service" | "timeout";

export class AuthServiceUnavailableError extends Error {
  readonly code = "auth_unavailable";

  constructor(
    readonly reason: AuthFailureReason,
    options?: ErrorOptions,
  ) {
    super("Authentication service unavailable", options);
    this.name = "AuthServiceUnavailableError";
  }
}

export function isInvalidSession(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (isAuthError(error) &&
      [
        "session_not_found",
        "session_expired",
        "refresh_token_not_found",
        "refresh_token_already_used",
        "bad_jwt",
        "invalid_jwt",
      ].includes(error.code ?? ""))
  );
}

/** One budget for all Auth calls in a request; database/storage fetches are unaffected. */
export class AuthAvailability {
  readonly controller = new AbortController();
  failure?: AuthServiceUnavailableError;

  constructor(
    readonly deadline = Date.now() + AUTH_BUDGET_MS,
    private readonly fetcher: typeof fetch = fetch,
    private readonly onFailure?: (error: AuthServiceUnavailableError) => void,
  ) {}

  fail(reason: AuthFailureReason, cause?: unknown): AuthServiceUnavailableError {
    if (!this.failure) {
      this.failure = new AuthServiceUnavailableError(reason, { cause });
      this.controller.abort(this.failure);
      this.onFailure?.(this.failure);
    }
    return this.failure;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input : input.url,
    );
    if (!url.pathname.startsWith("/auth/v1/")) return this.fetcher(input, init);
    if (this.failure) throw this.failure;
    if (Date.now() >= this.deadline) throw this.fail("timeout");

    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, this.controller.signal])
      : this.controller.signal;
    try {
      const response = await this.fetcher(input, { ...init, signal });
      if (this.failure) {
        void response.body?.cancel().catch(() => undefined);
        throw this.failure;
      }
      if (response.status >= 500) {
        void response.body?.cancel().catch(() => undefined);
        throw this.fail("service");
      }
      return response;
    } catch (error) {
      throw this.failure ?? this.fail("connection", error);
    }
  };

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.failure) throw this.failure;
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) throw this.fail("timeout");

    let rejectFailure!: (reason: unknown) => void;
    const failed = new Promise<never>((_, reject) => {
      rejectFailure = reject;
    });
    const onAbort = () => rejectFailure(this.failure);
    this.controller.signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => this.fail("timeout"), remaining);
    try {
      // The SDK may keep sleeping between refresh attempts. The race releases the
      // request; the aborted fetch adapter prevents those attempts reaching Auth.
      return await Promise.race([Promise.resolve().then(operation), failed]);
    } catch (error) {
      if (isAuthRetryableFetchError(error)) {
        throw this.fail(error.status >= 500 ? "service" : "connection", error);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      this.controller.signal.removeEventListener("abort", onAbort);
    }
  }
}
