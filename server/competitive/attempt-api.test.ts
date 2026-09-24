import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => ({ cookies: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: cookiesMock.cookies }));

import {
  assertSameOrigin,
  errorResponse,
  mapAttemptError,
  readJson,
  setAttemptToken,
} from "@/server/competitive/attempt-api";
import { AttemptCommandError } from "@/infrastructure/supabase/attemptCommands";
import { isJsonAnswer } from "@/app/api/competitive/attempts/[attemptId]/answer/route";
import { CompetitiveRateLimitError } from "@/server/competitive/rate-limit";

const originalScope = process.env.FLASH_RUNTIME_SCOPE;
const originalOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  vi.clearAllMocks();
  if (originalScope === undefined) delete process.env.FLASH_RUNTIME_SCOPE;
  else process.env.FLASH_RUNTIME_SCOPE = originalScope;
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
});

describe("competitive HTTP contract", () => {
  it("keeps attempt cookies alive for the bounded session TTL beyond the game deadline", async () => {
    cookiesMock.cookies.mockResolvedValue({ set: cookiesMock.set });

    await setAttemptToken("attempt-id", "auth-user-id", "scheduled-id", "secret-token");

    expect(cookiesMock.set).toHaveBeenCalledTimes(2);
    for (const call of cookiesMock.set.mock.calls) {
      expect(call[2]).toMatchObject({ httpOnly: true, maxAge: 60 * 60 });
    }
  });

  it("accepts the JSON answer shapes used by final-answer formats", () => {
    expect(isJsonAnswer(true)).toBe(true);
    expect(isJsonAnswer(36)).toBe(true);
    expect(isJsonAnswer(["San Diego", "Denver"])).toBe(true);
    expect(isJsonAnswer({ Brújula: "útil en 1890" })).toBe(true);
    expect(isJsonAnswer(Number.NaN)).toBe(false);
    expect(isJsonAnswer(undefined)).toBe(false);
  });

  it("rejects oversized JSON before parsing it", async () => {
    const body = JSON.stringify({ value: "x".repeat(33 * 1024) });

    await expect(
      readJson(new Request("http://127.0.0.1/api/competitive", { method: "POST", body })),
    ).rejects.toMatchObject({ code: "body_too_large", status: 413 });
  });

  it("requires the configured origin in pilot", () => {
    process.env.FLASH_RUNTIME_SCOPE = "pilot";
    process.env.APP_ORIGIN = "http://127.0.0.1:3000";

    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/competitive", {
          method: "POST",
          headers: { origin: "http://evil.example" },
        }),
      ),
    ).toThrow("invalid_origin");
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/competitive", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).not.toThrow();
  });

  it("maps database failures to a recoverable 503", () => {
    expect(mapAttemptError(new AttemptCommandError("database_unavailable"))).toMatchObject({
      code: "database_unavailable",
      status: 503,
    });
    const response = errorResponse(
      new AttemptCommandError("database_unavailable"),
      "request-123",
      "test.database",
    );
    expect(response.status).toBe(503);
  });

  it("returns the calculated Retry-After for rate-limited operations", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = errorResponse(
      new CompetitiveRateLimitError(7),
      "request-429",
      "competitive.alphabet.pass",
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", requestId: "request-429" },
    });
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      route: "competitive.alphabet.pass",
      operation: "competitive.alphabet.pass",
      status: 429,
      errorCode: "rate_limited",
    });
    log.mockRestore();
  });
});
