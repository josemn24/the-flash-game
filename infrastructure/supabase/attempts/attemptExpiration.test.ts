import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseAttemptExpiration } from "./attemptExpiration";

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/infrastructure/supabase/auth/service-client", () => ({
  createServiceClient: mocks.createServiceClient,
}));

const result = {
  runId: "history-test-run",
  evaluatedAt: "2026-10-14T20:00:00.000Z",
  abandonedAttempts: 2,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("SupabaseAttemptExpiration", () => {
  it("expires only the requested room and keeps its result contract", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null, status: 200 });
    await expect(
      new SupabaseAttemptExpiration().expireStaleAttemptsForRoom("room"),
    ).resolves.toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("expire_stale_attempts", {
      input: { roomSlug: "room", runId: expect.stringMatching(/^history-[0-9a-f-]{36}$/) },
    });
  });

  it.each([null, { ...result, abandonedAttempts: -1 }, { ...result, evaluatedAt: "invalid" }])(
    "rejects malformed results",
    async (data) => {
      mocks.rpc.mockResolvedValue({ data, error: null, status: 200 });
      await expect(
        new SupabaseAttemptExpiration().expireStaleAttemptsForRoom("room"),
      ).rejects.toThrow("invalid_response");
    },
  );

  it.each([
    ["22023", "attempt_expiration_invalid"],
    ["57014", "canceling statement due to statement timeout"],
  ])("preserves SQLSTATE %s, message and cause", async (code, message) => {
    const error = { code, message, details: "SQL diagnostics" };
    mocks.rpc.mockResolvedValue({ data: null, error, status: 400 });
    await expect(
      new SupabaseAttemptExpiration().expireStaleAttemptsForRoom("room"),
    ).rejects.toMatchObject({ code, message, cause: error });
  });

  it.each([
    [{ code: "", message: "fetch failed" }, 0],
    [{ code: "PGRST202", message: "function not in schema cache" }, 404],
    [{ code: "PGRST301", message: "invalid JWT" }, 401],
    [{ code: "PGRST003", message: "pool acquisition timeout" }, 504],
  ])("normalizes unavailable RPC responses", async (error, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error, status });
    await expect(
      new SupabaseAttemptExpiration().expireStaleAttemptsForRoom("room"),
    ).rejects.toMatchObject({ code: "database_unavailable", cause: error });
  });

  it("normalizes a rejected transport request", async () => {
    mocks.rpc.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      new SupabaseAttemptExpiration().expireStaleAttemptsForRoom("room"),
    ).rejects.toThrow("database_unavailable");
  });
});
