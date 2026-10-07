import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompetitiveCommandError,
  createCompetitiveIdempotencyKey,
  parseCompetitiveTimestamp,
  postCompetitiveJson,
} from "./transport";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("competitive transport", () => {
  it("parses successful JSON through the caller-provided parser", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ lockVersion: 4 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const value = await postCompetitiveJson(
      "/api/competitive/attempts/start",
      { idempotencyKey: "start:1" },
      (response) => ({ lockVersion: Number((response as { lockVersion: number }).lockVersion) }),
    );

    expect(value).toEqual({ lockVersion: 4 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/competitive/attempts/start",
      expect.objectContaining({ method: "POST", body: '{"idempotencyKey":"start:1"}' }),
    );
  });

  it("normalizes HTTP errors and Retry-After without losing the server code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "attempt_busy" } }), {
          status: 409,
          headers: { "retry-after": "3" },
        }),
      ),
    );

    await expect(
      postCompetitiveJson("/api/competitive/attempts/start", {}, (value) => value),
    ).rejects.toMatchObject({ code: "attempt_busy", status: 409, retryAfterSeconds: 3 });
  });

  it("preserves safe error metadata for explicit transfer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "attempt_control_required" },
            attempt: { attemptId: "attempt", lockVersion: 7, deadlineAt: null },
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(
      postCompetitiveJson("/api/competitive/attempts/start", {}, (value) => value),
    ).rejects.toMatchObject({
      code: "attempt_control_required",
      details: { attempt: { attemptId: "attempt", lockVersion: 7 } },
    });
  });

  it("reports invalid JSON and unknown HTTP error codes safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 500 })));
    await expect(
      postCompetitiveJson("/api/competitive/attempts/start", {}, (value) => value),
    ).rejects.toMatchObject({
      code: "competitive_command_failed",
      status: 500,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(
      postCompetitiveJson("/api/competitive/attempts/start", {}, (value) => value),
    ).rejects.toMatchObject({ code: "invalid_json_response", status: 200 });
  });

  it("generates distinct prefixed keys and parses only valid server timestamps", () => {
    const first = createCompetitiveIdempotencyKey("answer");
    const second = createCompetitiveIdempotencyKey("answer");
    expect(first).toMatch(/^answer:/);
    expect(second).toMatch(/^answer:/);
    expect(second).not.toBe(first);
    expect(parseCompetitiveTimestamp("2026-01-01T00:00:00.000Z")).toBe(
      Date.parse("2026-01-01T00:00:00.000Z"),
    );
    expect(() => parseCompetitiveTimestamp("invalid")).toThrow("invalid_server_timestamp");
  });

  it("exposes a typed command error", () => {
    const error = new CompetitiveCommandError("rate_limited", 429, 5);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ code: "rate_limited", status: 429, retryAfterSeconds: 5 });
  });
});

describe("bounded requests", () => {
  afterEach(() => vi.useRealTimers());
  it.each([5000, 10000])(
    "times out the whole response at %i ms without resending",
    async (timeoutMs) => {
      vi.useFakeTimers();
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: true, headers: new Headers(), json: () => new Promise(() => {}) });
      vi.stubGlobal("fetch", fetchMock);
      const pending = postCompetitiveJson("/answer", {}, (value) => value, { timeoutMs });
      const assertion = expect(pending).rejects.toMatchObject({
        code: "request_timeout",
        status: 0,
      });
      await vi.advanceTimersByTimeAsync(timeoutMs);
      await assertion;
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("cancels on detach and does not fetch with an already cancelled session", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      postCompetitiveJson("/answer", {}, (value) => value, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "request_cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
