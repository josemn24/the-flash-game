import { afterEach, describe, expect, it, vi } from "vitest";
import { logHttpEvent, requestIdFor, safePath } from "./http";

describe("HTTP observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a safe request id and strips the query from the path", () => {
    const request = new Request("https://example.test/salas/demo?token=secret", {
      headers: { "x-request-id": "request-123" },
    });

    expect(requestIdFor(request)).toBe("request-123");
    expect(safePath(request)).toBe("/salas/demo");
  });

  it("replaces unsafe request ids and emits only the allow-listed event fields", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logHttpEvent({
      requestId: requestIdFor(
        new Request("https://example.test", {
          headers: { "x-request-id": "token with spaces" },
        }),
      ),
      route: "/health",
      operation: "internal.health",
      status: 503,
      result: "error",
      durationMs: 12.7,
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"http_request"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"durationMs":13'));
    expect(log.mock.calls[0][0]).not.toContain("token with spaces");
  });
});
