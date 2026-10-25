import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredError,
  SuperadminAccessDeniedError,
} from "@/application/administration/errors";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ export: vi.fn() }));
vi.mock("@/server/product/room-measurement", () => ({ roomMeasurement: mocks }));
const roomId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const seasonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const request = () =>
  new Request(
    `http://localhost/admin/rooms/${roomId}/measurement/export?season=${seasonId}&dataset=participation`,
  );
const context = () => ({ params: Promise.resolve({ roomId }) });
beforeEach(() => vi.resetAllMocks());

describe("season CSV access", () => {
  it("exports the requested season as a private download", async () => {
    mocks.export.mockResolvedValue("private CSV");
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toContain(seasonId);
    expect(await response.text()).toBe("private CSV");
    expect(mocks.export).toHaveBeenCalledWith(roomId, seasonId, "participation");
  });
  it.each([
    [new AuthenticationRequiredError(), 401],
    [new SuperadminAccessDeniedError(), 403],
  ])("denies access without returning participant data", async (error, status) => {
    mocks.export.mockRejectedValue(error);
    const response = await GET(request(), context());
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "not_authorized" });
  });
  it("keeps an operational failure distinct from an access denial", async () => {
    mocks.export.mockRejectedValue(new Error("database_unavailable"));
    expect((await GET(request(), context())).status).toBe(503);
  });
});
