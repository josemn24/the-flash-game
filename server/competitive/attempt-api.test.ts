import { InvalidAttemptLifecycleError } from "@/lib/attemptLifecycle";
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
import { AttemptCommandError } from "@/infrastructure/supabase/attempts/attemptCommands";
import { AuthServiceUnavailableError } from "@/infrastructure/supabase/auth/auth-availability";
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

  it.each(["192.168.1.14:3000", "localhost:3000", "127.0.0.1:3000"])(
    "accepts the browser destination %s when Next uses its bind address internally",
    (host) => {
      process.env.FLASH_RUNTIME_SCOPE = "development";
      expect(() =>
        assertSameOrigin(
          new Request("http://0.0.0.0:3000/api/competitive/attempts/session", {
            method: "POST",
            headers: { host, origin: `http://${host}` },
          }),
        ),
      ).not.toThrow();
    },
  );

  it.each([
    "http://evil.example",
    "http://192.168.1.15:3000",
    "http://192.168.1.14:3001",
    "https://192.168.1.14:3000",
  ])("rejects a different browser origin %s even with an internal bind address", (origin) => {
    process.env.FLASH_RUNTIME_SCOPE = "development";
    expect(() =>
      assertSameOrigin(
        new Request("http://0.0.0.0:3000/api/competitive/attempts/session", {
          method: "POST",
          headers: { host: "192.168.1.14:3000", origin },
        }),
      ),
    ).toThrow("invalid_origin");
  });

  it("keeps localhost aliases working without a Host header", () => {
    process.env.FLASH_RUNTIME_SCOPE = "development";
    expect(() =>
      assertSameOrigin(
        new Request("http://127.0.0.1:3000/api/competitive/attempts/session", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });

  it.each(["user@192.168.1.14:3000", "192.168.1.14:3000/path", "192.168.1.14:3000?query"])(
    "rejects malformed Host authorities: %s",
    (host) => {
      process.env.FLASH_RUNTIME_SCOPE = "development";
      expect(() =>
        assertSameOrigin(
          new Request("http://0.0.0.0:3000/api/competitive/attempts/session", {
            headers: { host, origin: "http://192.168.1.14:3000" },
          }),
        ),
      ).toThrow("invalid_origin");
    },
  );

  it("does not let Host or forwarded headers override the canonical origin in pilot", () => {
    process.env.FLASH_RUNTIME_SCOPE = "pilot";
    process.env.APP_ORIGIN = "https://app.example";
    expect(() =>
      assertSameOrigin(
        new Request("https://app.example/api/competitive/attempts/session", {
          headers: {
            host: "evil.example",
            "x-forwarded-host": "evil.example",
            origin: "https://evil.example",
          },
        }),
      ),
    ).toThrow("invalid_origin");
  });

  it("maps Auth outages to 503 instead of an authentication failure", async () => {
    const response = errorResponse(
      new AuthServiceUnavailableError("timeout"),
      "request-auth",
      "test.auth",
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: "auth_unavailable", requestId: "request-auth" },
    });
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

  it("maps Queens overflow to a definitive bad request", () => {
    expect(mapAttemptError(new AttemptCommandError("queens_answer_overflow"))).toMatchObject({
      code: "queens_answer_overflow",
      status: 400,
    });
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

  it.each([
    new InvalidAttemptLifecycleError(),
    new AttemptCommandError("invalid_attempt_lifecycle"),
  ])("returns a sanitized internal contract error", async (error) => {
    const response = errorResponse(error, "lifecycle-test", "competitive.attempt.complete");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "invalid_attempt_lifecycle", requestId: "lifecycle-test" },
    });
  });

  it("returns the authoritative retry delay when Alphabet's deadline has not been reached", () => {
    const error = new AttemptCommandError("alphabet_deadline_not_reached", {
      detail: '{"retryAfterSeconds":3}',
    });
    const response = errorResponse(error, "deadline-test", "competitive.attempt.complete");
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("3");
  });
});
