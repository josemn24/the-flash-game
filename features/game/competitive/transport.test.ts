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
