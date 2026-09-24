import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  commandsFor: vi.fn(),
  consumeAlphabetActionRateLimit: vi.fn(),
  errorResponse: vi.fn(),
  readAttemptToken: vi.fn(),
  readJson: vi.fn(),
  optionalClientTime: vi.fn(),
  requireKey: vi.fn(),
  requireLockVersion: vi.fn(),
  requirePathUuid: vi.fn(),
  requireUuid: vi.fn(),
  responseFor: vi.fn(),
  requestIdFor: vi.fn(),
  verifiedIdentity: vi.fn(),
  readRecovery: vi.fn(),
  evaluateAndRecord: vi.fn(),
  pass: vi.fn(),
}));

vi.mock("@/server/competitive/attempt-api", () => ({
  AttemptApiError: class AttemptApiError extends Error {},
  assertSameOrigin: mocks.assertSameOrigin,
  commandsFor: mocks.commandsFor,
  errorResponse: mocks.errorResponse,
  readAttemptToken: mocks.readAttemptToken,
  readJson: mocks.readJson,
  optionalClientTime: mocks.optionalClientTime,
  requireKey: mocks.requireKey,
  requireLockVersion: mocks.requireLockVersion,
  requirePathUuid: mocks.requirePathUuid,
  requireUuid: mocks.requireUuid,
  responseFor: mocks.responseFor,
  requestIdFor: mocks.requestIdFor,
  verifiedIdentity: mocks.verifiedIdentity,
}));

vi.mock("@/server/competitive/rate-limit", () => ({
  consumeAlphabetActionRateLimit: mocks.consumeAlphabetActionRateLimit,
}));

import { POST } from "@/app/api/competitive/attempts/[attemptId]/answer/route";
import { POST as passPOST } from "@/app/api/competitive/attempts/[attemptId]/alphabet/pass/route";

describe("competitive Alphabet action rate limit routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReturnValue(undefined);
    mocks.requestIdFor.mockReturnValue("request-123");
    mocks.readJson.mockResolvedValue({ lockVersion: 2, answer: "ok" });
    mocks.requirePathUuid.mockReturnValue("attempt-123");
    mocks.requireLockVersion.mockReturnValue(2);
    mocks.requireKey.mockReturnValue("idempotency-key");
    mocks.requireUuid.mockReturnValue("item-123");
    mocks.verifiedIdentity.mockResolvedValue({ authUserId: "user-123" });
    mocks.readAttemptToken.mockResolvedValue("session-token");
    mocks.readRecovery.mockResolvedValue({ challengeMode: "alphabet" });
    mocks.evaluateAndRecord.mockResolvedValue({
      evaluated: { attemptId: "attempt-123", lockVersion: 3, status: "correct", points: 10 },
      received: { timedOut: false, timeUsedMs: 500 },
    });
    mocks.pass.mockResolvedValue({ attemptId: "attempt-123", lockVersion: 3 });
    mocks.commandsFor.mockReturnValue({
      readRecovery: mocks.readRecovery,
      evaluateAndRecord: mocks.evaluateAndRecord,
      pass: mocks.pass,
    });
    mocks.responseFor.mockReturnValue(Response.json({ ok: true }));
    mocks.errorResponse.mockImplementation((error: unknown) => {
      throw error;
    });
  });

  it("uses the persisted attempt mode to limit Alphabet answers", async () => {
    const response = await POST(
      new Request("http://localhost/api/competitive/attempts/attempt-123/answer", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ attemptId: "attempt-123" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.readRecovery).toHaveBeenCalledWith("attempt-123", "session-token");
    expect(mocks.consumeAlphabetActionRateLimit).toHaveBeenCalledWith("user-123", "attempt-123");
    expect(mocks.evaluateAndRecord).toHaveBeenCalledOnce();
  });

  it("does not apply the Alphabet action limit to other persisted modes", async () => {
    mocks.readRecovery.mockResolvedValue({ challengeMode: "pyramid" });

    const response = await POST(
      new Request("http://localhost/api/competitive/attempts/attempt-123/answer", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ attemptId: "attempt-123" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.consumeAlphabetActionRateLimit).not.toHaveBeenCalled();
    expect(mocks.evaluateAndRecord).toHaveBeenCalledOnce();
  });

  it("uses the same action limiter for a pass", async () => {
    const response = await passPOST(
      new Request("http://localhost/api/competitive/attempts/attempt-123/alphabet/pass", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ attemptId: "attempt-123" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.readRecovery).toHaveBeenCalledWith("attempt-123", "session-token");
    expect(mocks.consumeAlphabetActionRateLimit).toHaveBeenCalledWith("user-123", "attempt-123");
    expect(mocks.pass).toHaveBeenCalledOnce();
  });
});
