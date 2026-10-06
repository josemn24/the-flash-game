import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthAvailability } from "./auth-availability";
import { createSessionClient } from "./session-client";
import { syntheticSession } from "@/test-utils/supabase-session";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("bounded session client with real Supabase SDK", () => {
  it("loads a missing session without contacting Auth", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createSessionClient(
      { getAll: () => [], setAll: vi.fn() },
      new AuthAvailability(undefined, fetcher),
    );
    expect((await client.auth.getClaims()).error).toBeNull();
    expect((await client.auth.getUser()).data.user).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["connection", "service"] as const)(
    "preserves expired cookies and prevents SDK network retries after %s",
    async (reason) => {
      vi.useFakeTimers();
      const { cookie } = syntheticSession();
      const setAll = vi.fn();
      const fetcher = vi.fn<typeof fetch>(async () => {
        if (reason === "connection") throw new TypeError("fetch failed");
        return new Response("{}", { status: 503 });
      });
      const client = createSessionClient(
        { getAll: () => [cookie], setAll },
        new AuthAvailability(undefined, fetcher),
      );
      await expect(client.auth.getClaims()).rejects.toMatchObject({ reason });
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(setAll).not.toHaveBeenCalled();
    },
  );

  it("discards a successful refresh that arrives after timeout", async () => {
    vi.useFakeTimers();
    const { cookie } = syntheticSession();
    const { session } = syntheticSession(false);
    let complete!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const setAll = vi.fn();
    const client = createSessionClient(
      { getAll: () => [cookie], setAll },
      new AuthAvailability(undefined, fetcher),
    );
    const assertion = expect(client.auth.getClaims()).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    complete(Response.json(session));
    await vi.advanceTimersByTimeAsync(30000);
    expect(setAll).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refreshes and verifies a healthy session, including cookie rotation", async () => {
    const { cookie } = syntheticSession();
    const { session } = syntheticSession(false);
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      Response.json(String(input).includes("/token") ? session : session.user),
    );
    const setAll = vi.fn();
    const client = createSessionClient(
      { getAll: () => [cookie], setAll },
      new AuthAvailability(undefined, fetcher),
    );
    expect((await client.auth.getClaims()).data?.claims.sub).toBe(session.user.id);
    expect((await client.auth.getUser()).data.user?.id).toBe(session.user.id);
    expect(setAll).toHaveBeenCalled();
  });

  it("removes a genuinely invalidated session instead of treating it as an outage", async () => {
    const { cookie } = syntheticSession();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { code: "refresh_token_not_found", message: "Invalid refresh token" },
        { status: 400, headers: { "x-supabase-api-version": "2024-01-01" } },
      ),
    );
    const setAll = vi.fn();
    const client = createSessionClient(
      { getAll: () => [cookie], setAll },
      new AuthAvailability(undefined, fetcher),
    );
    expect((await client.auth.getClaims()).error?.code).toBe("refresh_token_not_found");
    expect(
      setAll.mock.calls.some(([cookies]) =>
        cookies.some((value: { options: { maxAge?: number } }) => value.options.maxAge === 0),
      ),
    ).toBe(true);
  });

  it("returns login rate limits through the existing SDK contract", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ code: "over_request_rate_limit", message: "Try later" }, { status: 429 }),
    );
    const client = createSessionClient(
      { getAll: () => [], setAll: vi.fn() },
      new AuthAvailability(undefined, fetcher),
    );
    expect(
      (await client.auth.signInWithPassword({ email: "test@example.com", password: "password" }))
        .error?.status,
    ).toBe(429);
  });

  it("keeps the session when logout cannot reach Auth", async () => {
    const { cookie } = syntheticSession(false);
    const setAll = vi.fn();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({}, { status: 503 }));
    const client = createSessionClient(
      { getAll: () => [cookie], setAll },
      new AuthAvailability(undefined, fetcher),
    );
    await expect(client.auth.signOut()).rejects.toMatchObject({ reason: "service" });
    expect(setAll).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
