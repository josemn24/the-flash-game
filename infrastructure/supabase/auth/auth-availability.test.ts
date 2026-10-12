import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthInvalidJwtError, AuthSessionMissingError } from "@supabase/supabase-js";
import { AuthAvailability, isInvalidSession } from "./auth-availability";

afterEach(() => {
  vi.useRealTimers();
});

describe("request Auth budget", () => {
  it("cancels a hanging request at the shared deadline", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const budget = new AuthAvailability(Date.now() + 5000, fetcher);
    const result = budget.run(() => budget.fetch("http://127.0.0.1/auth/v1/user"));
    const assertion = expect(result).rejects.toMatchObject({
      code: "auth_unavailable",
      reason: "timeout",
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await expect(budget.fetch("http://127.0.0.1/auth/v1/token")).rejects.toMatchObject({
      reason: "timeout",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not reset the budget for a second operation", async () => {
    vi.useFakeTimers();
    const budget = new AuthAvailability(Date.now() + 5000);
    await budget.run(async () => "claims");
    await vi.advanceTimersByTimeAsync(4000);
    const result = budget.run(() => new Promise(() => {}));
    const assertion = expect(result).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it.each(["connection", "service"] as const)("stops immediately on %s failure", async (reason) => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (reason === "connection") throw new TypeError("fetch failed");
      return new Response("unavailable", { status: 503 });
    });
    const log = vi.fn();
    const budget = new AuthAvailability(undefined, fetcher, log);
    await expect(
      budget.run(() => budget.fetch("http://127.0.0.1/auth/v1/token")),
    ).rejects.toMatchObject({ reason });
    await expect(budget.run(async () => "retry")).rejects.toMatchObject({ reason });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
  });

  it("preserves caller cancellation and leaves database fetches outside the Auth budget", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"));
    const caller = new AbortController();
    const budget = new AuthAvailability(undefined, fetcher);
    await budget.fetch("http://127.0.0.1/auth/v1/user", { signal: caller.signal });
    caller.abort();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    budget.fail("timeout");
    await budget.fetch("http://127.0.0.1/rest/v1/players");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.signal).toBeUndefined();
  });

  it("distinguishes invalid sessions from service errors and rate limits", () => {
    expect(isInvalidSession(new AuthSessionMissingError())).toBe(true);
    expect(isInvalidSession(new AuthInvalidJwtError("Invalid JWT"))).toBe(true);
    expect(isInvalidSession(new AuthApiError("invalid", 400, "refresh_token_not_found"))).toBe(
      true,
    );
    expect(isInvalidSession(new AuthApiError("busy", 429, "over_request_rate_limit"))).toBe(false);
    expect(isInvalidSession(new AuthApiError("unavailable", 503, undefined))).toBe(false);
  });
});
