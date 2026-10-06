import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";
import { AUTH_DEADLINE_HEADER, AUTH_FAILURE_HEADER } from "./auth-availability";
import { syntheticSession } from "@/test-utils/supabase-session";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-key");
  logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("proxy Auth availability", () => {
  it("overwrites browser-supplied availability and deadline headers", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const before = Date.now();
    const response = await updateSession(
      new NextRequest("http://localhost/", {
        headers: {
          [AUTH_FAILURE_HEADER]: "service",
          [AUTH_DEADLINE_HEADER]: String(before + 999999),
        },
      }),
    );
    expect(response.headers.get(`x-middleware-request-${AUTH_FAILURE_HEADER}`)).toBeNull();
    const deadline = Number(response.headers.get(`x-middleware-request-${AUTH_DEADLINE_HEADER}`));
    expect(deadline).toBeGreaterThanOrEqual(before + 5000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 5000);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards an outage without cookies or a second upstream attempt", async () => {
    vi.useFakeTimers();
    const { cookie } = syntheticSession();
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetcher);
    const response = await updateSession(
      new NextRequest("http://localhost/", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      }),
    );
    expect(response.headers.get(`x-middleware-request-${AUTH_FAILURE_HEADER}`)).toBe("connection");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      `${cookie.name}=${cookie.value}`,
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"operation":"auth.proxy"'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps a successful token rotation when subsequent user verification fails", async () => {
    vi.useFakeTimers();
    const { cookie } = syntheticSession();
    const { session } = syntheticSession(false);
    session.refresh_token = "synthetic-rotated-token";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) =>
        String(input).includes("/token")
          ? Response.json(session)
          : Response.json({}, { status: 503 }),
      ),
    );
    const response = await updateSession(
      new NextRequest("http://localhost/", {
        headers: {
          cookie: `${cookie.name}=${cookie.value}`,
        },
      }),
    );
    expect(response.headers.get(`x-middleware-request-${AUTH_FAILURE_HEADER}`)).toBe("service");
    expect(response.cookies.get(cookie.name)?.value).not.toBe(cookie.value);
    expect(response.cookies.get(cookie.name)?.maxAge).not.toBe(0);
    await vi.advanceTimersByTimeAsync(30000);
  });
});
