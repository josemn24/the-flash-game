import { describe, expect, it, vi } from "vitest";
import type { RoomMeasurementGateway } from "@/application/ports/room-measurement";
import { RoomMeasurementUseCases } from "./room-measurement";
import { seasonSources } from "@/test-utils/seasonMeasurement";

const roomId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const seasonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function setup() {
  const admin = vi.fn().mockResolvedValue(undefined);
  const gateway: RoomMeasurementGateway = { season: vi.fn().mockResolvedValue(seasonSources()) };
  return { admin, gateway, useCases: new RoomMeasurementUseCases(gateway, admin) };
}
describe("season measurement administration", () => {
  it("requires an administrator before reading or exporting", async () => {
    const { admin, gateway, useCases } = setup();
    admin.mockRejectedValue(new Error("not_authorized"));
    await expect(useCases.season(roomId, seasonId)).rejects.toThrow("not_authorized");
    await expect(useCases.export(roomId, seasonId, "participants")).rejects.toThrow(
      "not_authorized",
    );
    expect(gateway.season).not.toHaveBeenCalled();
  });
  it("rejects malformed identifiers before reaching the database", async () => {
    const { gateway, useCases } = setup();
    await expect(useCases.season("room", seasonId)).rejects.toThrow("invalid_room_measurement");
    await expect(useCases.season(roomId, "season")).rejects.toThrow("invalid_room_measurement");
    expect(gateway.season).not.toHaveBeenCalled();
  });
  it("calculates the selected season and produces each supported CSV", async () => {
    const { gateway, useCases } = setup();
    const report = await useCases.season(roomId, seasonId);
    expect(gateway.season).toHaveBeenCalledWith(roomId, seasonId);
    expect(report?.metrics.competitiveCompletions).toBe(1);
    for (const dataset of ["participants", "participation", "challenges", "summary"] as const) {
      expect(await useCases.export(roomId, seasonId, dataset)).toContain("season_id");
    }
  });
});
