import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  prepareSession: vi.fn(),
  start: vi.fn(),
  readStartAttemptToken: vi.fn(),
  setStartAttemptToken: vi.fn(),
  setAttemptToken: vi.fn(),
}));
vi.mock("@/server/competitive/attempt-api", () => ({
  assertSameOrigin: vi.fn(),
  commandsFor: () => ({ prepareSession: mocks.prepareSession, start: mocks.start }),
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
  requireUuid: (body: Record<string, string>, key: string) => body[key],
  requireKey: (body: { idempotencyKey: string }) => body.idempotencyKey,
  verifiedIdentity: async () => ({ authUserId: "user" }),
  readStartAttemptToken: mocks.readStartAttemptToken,
  setStartAttemptToken: mocks.setStartAttemptToken,
  setAttemptToken: mocks.setAttemptToken,
  newAttemptToken: () => "new-secret-token",
  requestIdFor: () => "request",
  responseFor: (value: unknown) => Response.json(value),
}));
import { POST as prepare } from "./session/route";
import { POST as start } from "./start/route";
const request = () =>
  new Request("http://localhost/api/competitive/attempts/session", {
    method: "POST",
    body: JSON.stringify({ scheduledChallengeId: "publication", idempotencyKey: "original-key" }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepareSession.mockResolvedValue({ ready: true });
  mocks.start.mockResolvedValue({
    sessionToken: "token",
    result: { attemptId: "attempt", lockVersion: 1, controlRequired: false },
  });
});
describe("session before start", () => {
  it("authorizes and sets a cookie without starting an attempt or exposing tokens", async () => {
    expect(await (await prepare(request())).json()).toEqual({ ready: true });
    expect(mocks.prepareSession).toHaveBeenCalledWith({ scheduledChallengeId: "publication" });
    expect(mocks.setStartAttemptToken).toHaveBeenCalledWith(
      "user",
      "publication",
      "new-secret-token",
    );
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("reuses a previously confirmed cookie", async () => {
    mocks.readStartAttemptToken.mockResolvedValue("existing-token");
    await prepare(request());
    expect(mocks.setStartAttemptToken).toHaveBeenCalledWith(
      "user",
      "publication",
      "existing-token",
    );
  });
  it("cannot start without the cookie", async () => {
    expect(await (await start(request())).json()).toEqual({
      error: { code: "attempt_session_missing" },
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("forwards the same token and operation key on every start retry", async () => {
    mocks.readStartAttemptToken.mockResolvedValue("existing-token");
    await start(request());
    await start(request());
    expect(mocks.start.mock.calls[1]).toEqual(mocks.start.mock.calls[0]);
    expect(mocks.start).toHaveBeenCalledWith({
      scheduledChallengeId: "publication",
      sessionToken: "existing-token",
      idempotencyKey: "original-key",
    });
  });
  it("does not set cookies when authorization fails", async () => {
    mocks.prepareSession.mockRejectedValue({ code: "not_authorized" });
    expect((await prepare(request())).status).toBe(409);
    expect(mocks.setStartAttemptToken).not.toHaveBeenCalled();
  });
});
