import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttemptCommandError } from "@/infrastructure/supabase/attempts/attemptCommands";
import { SuperadminAttemptCommandError } from "@/application/administration/errors";
import { adjustSuperadminAttempt, invalidateSuperadminAttempt } from "./admin-attempt";

const mocks = vi.hoisted(() => ({
  consumeAdminRateLimit: vi.fn(),
  adjust: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/server/competitive/rate-limit", () => ({
  consumeAdminRateLimit: mocks.consumeAdminRateLimit,
}));

function commands() {
  return {
    adjust: mocks.adjust,
    invalidate: mocks.invalidate,
  };
}

const input = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  lockVersion: 3,
  reason: "Corrección administrativa",
  idempotencyKey: "admin-operation-001",
};

const result = {
  attemptId: input.attemptId,
  lockVersion: 4,
  status: "completed" as const,
  effectiveScore: 80,
};

describe("superadmin attempt server facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adjust.mockResolvedValue(result);
    mocks.invalidate.mockResolvedValue({ ...result, status: "invalidated" });
  });

  it("delegates score adjustments through the administrative port and rate limit", async () => {
    await expect(
      adjustSuperadminAttempt("auth-superadmin", { ...input, score: 80 }, commands()),
    ).resolves.toEqual(result);

    expect(mocks.consumeAdminRateLimit).toHaveBeenCalledWith("superadmin");
    expect(mocks.adjust).toHaveBeenCalledWith({ ...input, score: 80 });
  });

  it("delegates invalidations through the administrative port and rate limit", async () => {
    const expected = { ...result, status: "invalidated" as const };

    await expect(
      invalidateSuperadminAttempt("auth-superadmin", input, commands()),
    ).resolves.toEqual(expected);

    expect(mocks.consumeAdminRateLimit).toHaveBeenCalledWith("superadmin");
    expect(mocks.invalidate).toHaveBeenCalledWith(input);
  });

  it.each([
    [
      "adjust",
      () => adjustSuperadminAttempt("auth-superadmin", { ...input, score: 80 }, commands()),
    ],
    ["invalidate", () => invalidateSuperadminAttempt("auth-superadmin", input, commands())],
  ])("maps AttemptCommandError from %s to the administrative error", async (_operation, call) => {
    const cause = new AttemptCommandError("stale_version");
    mocks.adjust.mockRejectedValue(cause);
    mocks.invalidate.mockRejectedValue(cause);

    await expect(call()).rejects.toBeInstanceOf(SuperadminAttemptCommandError);
    await expect(call()).rejects.toMatchObject({
      code: "stale_version",
      name: "SuperadminAttemptCommandError",
    });
  });
});
