import { afterEach, describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  errorResponse,
  mapAttemptError,
  readJson,
} from "@/server/competitive/attempt-api";
import { AttemptCommandError } from "@/infrastructure/supabase/attemptCommands";
import { isJsonAnswer } from "@/app/api/competitive/attempts/[attemptId]/answer/route";

const originalScope = process.env.FLASH_RUNTIME_SCOPE;
const originalOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  if (originalScope === undefined) delete process.env.FLASH_RUNTIME_SCOPE;
  else process.env.FLASH_RUNTIME_SCOPE = originalScope;
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
});

describe("competitive HTTP contract", () => {
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
});
