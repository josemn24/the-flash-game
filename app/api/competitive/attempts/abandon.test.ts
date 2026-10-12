import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  abandon: vi.fn(),
  readAttemptToken: vi.fn(),
  readAbandonedAttemptResult: vi.fn(),
  clearAttemptToken: vi.fn(),
}));
vi.mock("@/server/competitive/attempt-api", () => ({
  assertSameOrigin: vi.fn(),
  commandsFor: () => ({ abandon: mocks.abandon }),
  errorResponse: (error: unknown) => Response.json({ error }, { status: 409 }),
  readAttemptToken: mocks.readAttemptToken,
  clearAttemptToken: mocks.clearAttemptToken,
  readJson: (request: Request) => request.json(),
  requireLockVersion: (body: { lockVersion: number }) => body.lockVersion,
  requirePathUuid: (value: string) => value,
  verifiedIdentity: async () => ({ authUserId: "user" }),
  requestIdFor: () => "request",
  mapAttemptError: (error: { code: string }) => error,
  responseFor: (value: unknown) => Response.json(value),
}));
vi.mock("@/server/competitive/flashResult", () => ({
  readAbandonedAttemptResult: mocks.readAbandonedAttemptResult,
}));
import { POST } from "./[attemptId]/abandon/route";
const result = { attemptId: "attempt", status: "abandoned", lockVersion: 3, score: 0 };
const invoke = () =>
  POST(
    new Request("http://localhost/api/competitive/attempts/attempt/abandon", {
      method: "POST",
      body: JSON.stringify({ confirm: true, lockVersion: 2 }),
    }),
    { params: Promise.resolve({ attemptId: "attempt" }) },
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.readAttemptToken.mockResolvedValue("token");
  mocks.abandon.mockResolvedValue({ result, scheduledChallengeId: "publication" });
});
it("returns the accepted abandonment and revokes its cookie", async () => {
  expect(await (await invoke()).json()).toEqual(result);
  expect(mocks.abandon).toHaveBeenCalledWith({
    attemptId: "attempt",
    sessionToken: "token",
    lockVersion: 2,
    idempotencyKey: "abandon:attempt",
  });
  expect(mocks.clearAttemptToken).toHaveBeenCalledWith("attempt", "user", "publication");
});
it.each(["attempt_session_missing", "session_revoked", "attempt_terminal"])(
  "recovers the exact saved abandonment after %s",
  async (code) => {
    if (code === "attempt_session_missing") mocks.readAttemptToken.mockRejectedValue({ code });
    else mocks.abandon.mockRejectedValue({ code });
    mocks.readAbandonedAttemptResult.mockResolvedValue({
      result,
      scheduledChallengeId: "publication",
    });
    expect(await (await invoke()).json()).toEqual(result);
    expect(mocks.readAbandonedAttemptResult).toHaveBeenCalledWith("attempt", {
      authUserId: "user",
    });
    expect(mocks.abandon).toHaveBeenCalledTimes(code === "attempt_session_missing" ? 0 : 1);
  },
);
it("does not expose an abandoned result after permission is lost", async () => {
  mocks.abandon.mockRejectedValue({ code: "not_authorized" });
  mocks.readAbandonedAttemptResult.mockResolvedValue(undefined);
  expect((await invoke()).status).toBe(409);
  expect(mocks.clearAttemptToken).not.toHaveBeenCalled();
});
it("preserves a version conflict without falling back to another result", async () => {
  mocks.abandon.mockRejectedValue({ code: "stale_version" });
  expect((await invoke()).status).toBe(409);
  expect(mocks.readAbandonedAttemptResult).not.toHaveBeenCalled();
});
