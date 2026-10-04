import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  recover: vi.fn(),
  readAttemptToken: vi.fn(),
  readTerminalAlphabetResult: vi.fn(),
  readTerminalFlashReview: vi.fn(),
  clearAttemptToken: vi.fn(),
}));
vi.mock("@/server/competitive/attempt-api", () => ({
  assertSameOrigin: vi.fn(),
  commandsFor: () => ({ complete: mocks.complete, recover: mocks.recover }),
  errorResponse: (error: unknown) => Response.json({ error }, { status: 409 }),
  readAttemptToken: mocks.readAttemptToken,
  clearAttemptToken: mocks.clearAttemptToken,
  readJson: (request: Request) => request.json(),
  requireKey: (body: { idempotencyKey: string }) => body.idempotencyKey,
  requireLockVersion: (body: { lockVersion: number }) => body.lockVersion,
  requirePathUuid: (value: string) => value,
  verifiedIdentity: async () => ({ authUserId: "user" }),
  requestIdFor: () => "request",
  mapAttemptError: (error: { code: string }) => error,
  responseFor: (value: unknown) => Response.json(value),
}));
vi.mock("@/server/competitive/flashResult", () => ({
  readTerminalAlphabetResult: mocks.readTerminalAlphabetResult,
  readTerminalFlashReview: mocks.readTerminalFlashReview,
}));
import { POST } from "./[attemptId]/complete/route";
import { POST as recover } from "./[attemptId]/recover/route";
const answers = [
  { challengeItemId: "A", status: "unanswered", answer: null, points: 0, timeUsedMs: 0 },
];
const result = { attemptId: "attempt", status: "completed", lockVersion: 3, score: 0, answers };
const invoke = (extra = {}) =>
  POST(
    new Request("http://localhost/api/competitive/attempts/attempt/complete", {
      method: "POST",
      body: JSON.stringify({ lockVersion: 2, idempotencyKey: "close-key", ...extra }),
    }),
    { params: Promise.resolve({ attemptId: "attempt" }) },
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.readAttemptToken.mockResolvedValue("token");
  mocks.complete.mockResolvedValue({ result, scheduledChallengeId: "publication" });
  mocks.readTerminalFlashReview.mockResolvedValue([]);
});
describe("Alphabet completion HTTP contract", () => {
  it("returns all final answers and forwards only the authorized browser fields", async () => {
    const response = await invoke({ score: 100, pendingEvaluation: { points: 100 } });
    expect(await response.json()).toEqual({ ...result, review: [] });
    expect(mocks.complete).toHaveBeenCalledWith({
      attemptId: "attempt",
      sessionToken: "token",
      lockVersion: 2,
      idempotencyKey: "close-key",
    });
    expect(mocks.clearAttemptToken).toHaveBeenCalledWith("attempt", "user", "publication");
  });
  it.each(["attempt_session_missing", "session_revoked", "not_authorized", "attempt_terminal"])(
    "reads the authorized saved result after %s",
    async (code) => {
      mocks.complete.mockRejectedValue({ code });
      mocks.readTerminalAlphabetResult.mockResolvedValue({
        result: { ...result, review: [] },
        scheduledChallengeId: "publication",
      });
      expect((await invoke()).status).toBe(200);
      expect(mocks.readTerminalAlphabetResult).toHaveBeenCalledWith("attempt");
      expect(mocks.complete).toHaveBeenCalledTimes(1);
    },
  );
  it("recovers when the successful first completion removed the cookie", async () => {
    mocks.readAttemptToken.mockRejectedValue({ code: "attempt_session_missing" });
    mocks.readTerminalAlphabetResult.mockResolvedValue({
      result: { ...result, review: [] },
      scheduledChallengeId: "publication",
    });
    expect(await (await invoke()).json()).toEqual({ ...result, review: [] });
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("keeps an authorization error when no accessible terminal result exists", async () => {
    mocks.complete.mockRejectedValue({ code: "not_authorized" });
    mocks.readTerminalAlphabetResult.mockResolvedValue(undefined);
    expect((await invoke()).status).toBe(409);
    expect(mocks.clearAttemptToken).not.toHaveBeenCalled();
  });
  it.each(["attempt_session_missing", "session_revoked"])(
    "recovers a terminal Alphabet after recovery lost its response and reports %s",
    async (code) => {
      if (code === "attempt_session_missing") mocks.readAttemptToken.mockRejectedValue({ code });
      else mocks.recover.mockRejectedValue({ code });
      mocks.readTerminalAlphabetResult.mockResolvedValue({
        result: { ...result, review: [] },
        scheduledChallengeId: "publication",
      });
      const response = await recover(
        new Request("http://localhost/api/competitive/attempts/attempt/recover", {
          method: "POST",
          body: JSON.stringify({ lockVersion: 2 }),
        }),
        { params: Promise.resolve({ attemptId: "attempt" }) },
      );
      expect(await response.json()).toEqual({ ...result, review: [], phase: "results" });
      expect(mocks.complete).not.toHaveBeenCalled();
      expect(mocks.clearAttemptToken).toHaveBeenCalledWith("attempt", "user", "publication");
    },
  );
});
