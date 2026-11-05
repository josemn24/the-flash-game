import { afterEach, describe, expect, it, vi } from "vitest";
import { sendProductEvent } from "./transport";
import { measurementDay, measurementId } from "@/test-utils/productMeasurement";
const event = {
  eventId: measurementId(1),
  type: "room_viewed" as const,
  roomId: "tabarnia",
  visitId: measurementId(2),
  occurredAt: measurementDay(0),
  appVersion: "test",
};
afterEach(() => vi.useRealTimers());
describe("non-blocking measurement transport", () => {
  it("retries a network failure once using the same identifier", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const pending = sendProductEvent(event, fetcher);
    await vi.runAllTimersAsync();
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]).toEqual(fetcher.mock.calls[1][1]);
  });
  it.each([204, 400, 403, 429])("does not retry status %i", async (status) => {
    const fetcher = vi.fn().mockResolvedValue({ ok: status === 204, status });
    await sendProductEvent(event, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
