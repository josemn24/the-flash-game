import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  takeOver: vi.fn(),
  readStartAttemptToken: vi.fn(),
  setAttemptToken: vi.fn(),
}));

vi.mock("@/server/competitive/attempt-api", () => ({
  assertSameOrigin: vi.fn(),
  commandsFor: () => ({ takeOver: mocks.takeOver }),
  errorResponse: (error: { code?: string }) =>
    Response.json({ error: { code: error.code } }, { status: 409 }),
  AttemptApiError: class extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
  readJson: (request: Request) => request.json(),
  readStartAttemptToken: mocks.readStartAttemptToken,
  requireKey: (body: { idempotencyKey: string }) => body.idempotencyKey,
  requireLockVersion: (body: { lockVersion: number }) => body.lockVersion,
  requirePathUuid: (value: string) => value,
  requireUuid: (body: Record<string, string>, key: string) => body[key],
  requestIdFor: () => "request",
  responseFor: (value: unknown, status = 200) => Response.json(value, { status }),
  setAttemptToken: mocks.setAttemptToken,
  verifiedIdentity: async () => ({ authUserId: "user" }),
}));

import { POST } from "./[attemptId]/takeover/route";

const invoke = () =>
  POST(
    new Request("http://localhost/api/competitive/attempts/attempt/takeover", {
      method: "POST",
      body: JSON.stringify({
        scheduledChallengeId: "publication",
        lockVersion: 7,
        idempotencyKey: "takeover:key",
      }),
    }),
    { params: Promise.resolve({ attemptId: "attempt" }) },
  );

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readStartAttemptToken.mockResolvedValue("candidate-token");
  mocks.takeOver.mockResolvedValue({
    sessionToken: "candidate-token",
    result: {
      attemptId: "attempt",
      sessionId: "session",
      lockVersion: 8,
      deadlineAt: "2026-10-07T10:00:00.000Z",
      transferred: true,
    },
  });
});

describe("attempt takeover HTTP contract", () => {
  it("uses the prepared candidate token and only sets the controller cookie after success", async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      attemptId: "attempt",
      sessionId: "session",
      lockVersion: 8,
      deadlineAt: "2026-10-07T10:00:00.000Z",
      transferred: true,
    });
    expect(mocks.takeOver).toHaveBeenCalledWith({
      attemptId: "attempt",
      scheduledChallengeId: "publication",
      lockVersion: 7,
      idempotencyKey: "takeover:key",
      sessionToken: "candidate-token",
    });
    expect(mocks.setAttemptToken).toHaveBeenCalledWith(
      "attempt",
      "user",
      "publication",
      "candidate-token",
    );
  });

  it("rejects a device that was not prepared by /session", async () => {
    mocks.readStartAttemptToken.mockResolvedValue(undefined);
    const response = await invoke();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "takeover_not_prepared" } });
    expect(mocks.takeOver).not.toHaveBeenCalled();
    expect(mocks.setAttemptToken).not.toHaveBeenCalled();
  });
});
