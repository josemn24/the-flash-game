import { afterEach, describe, expect, it, vi } from "vitest";
import { measurementId, measurementDay } from "@/test-utils/productMeasurement";
const capture = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/server/product/measurement", () => ({ productMeasurement: { capture } }));
import { POST } from "./route";
afterEach(() => vi.clearAllMocks());
const event = {
  eventId: measurementId(1),
  type: "room_viewed",
  roomId: "tabarnia",
  visitId: measurementId(2),
  occurredAt: measurementDay(0),
  appVersion: "test",
};
const request = (body: unknown) =>
  new Request("http://127.0.0.1:3000/api/product/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("product event route", () => {
  it("returns a non-cacheable acknowledgement", async () => {
    const result = await POST(request(event));
    expect(result.status).toBe(204);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("passes a valid future browser timestamp unchanged", async () => {
    const body = { ...event, occurredAt: new Date(Date.now() + 86_400_000).toISOString() };
    expect((await POST(request(body))).status).toBe(204);
    expect(capture).toHaveBeenCalledExactlyOnceWith(body);
  });
  it.each(["invalid", "infinity", "-infinity"])(
    "rejects invalid browser date %s",
    async (occurredAt) => {
      expect((await POST(request({ ...event, occurredAt }))).status).toBe(400);
      expect(capture).not.toHaveBeenCalled();
    },
  );
  it("does not access storage for malformed or oversized input", async () => {
    expect((await POST(request("x".repeat(4097)))).status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });
  it("filters authentication and rate-limit errors", async () => {
    capture.mockRejectedValueOnce(new Error("not_authorized"));
    expect((await POST(request(event))).status).toBe(403);
    capture.mockRejectedValueOnce(new Error("measurement_rate_limited"));
    const result = await POST(request(event));
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("60");
  });
});
