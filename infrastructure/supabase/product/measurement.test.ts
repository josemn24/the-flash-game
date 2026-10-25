import { beforeEach, describe, expect, it, vi } from "vitest";
import { measurementDay, measurementId } from "@/test-utils/productMeasurement";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/supabase/auth/server-client", () => ({
  createClient: async () => ({ rpc }),
}));
import { supabaseProductMeasurement } from "./measurement";
beforeEach(() => vi.resetAllMocks());

describe("season signal persistence", () => {
  it("sends each observation to exactly one season RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const input = {
      eventId: measurementId(1),
      visitId: measurementId(2),
      roomId: "room",
      type: "room_viewed" as const,
      occurredAt: measurementDay(0),
      appVersion: "test",
    };
    await supabaseProductMeasurement.capture(input);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("record_room_measurement_event", { input });
  });
  it("reads and writes the single season enjoyment instrument", async () => {
    const saved = { eligible: true, value: 4, seasonId: measurementId(3) };
    rpc.mockResolvedValue({ data: saved, error: null });
    const input = {
      id: measurementId(1),
      publicationId: measurementId(2),
      seasonId: saved.seasonId,
      value: 4,
    };
    expect(await supabaseProductMeasurement.rating(input.publicationId)).toEqual(saved);
    expect(rpc).toHaveBeenLastCalledWith("get_my_season_rating", {
      target_publication_id: input.publicationId,
    });
    expect(await supabaseProductMeasurement.rate(input)).toEqual(saved);
    expect(rpc).toHaveBeenLastCalledWith("save_my_season_rating", { input });
  });
  it("propagates authorization and quota failures", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(supabaseProductMeasurement.rating(measurementId(1))).rejects.toThrow(
      "not_authorized",
    );
    rpc.mockResolvedValueOnce({ data: null, error: { message: "measurement_rate_limited" } });
    await expect(supabaseProductMeasurement.rating(measurementId(1))).rejects.toThrow(
      "measurement_rate_limited",
    );
  });
});
