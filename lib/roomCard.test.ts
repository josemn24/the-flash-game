import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { buildRoomCardModel, ROOM_ART_FALLBACK } from "@/lib/roomCard";

const now = new Date("2026-09-06T12:00:00.000Z");

describe("buildRoomCardModel", () => {
  it("combines the daily challenge and current user's room ranking", () => {
    const model = buildRoomCardModel(demoRoom, now);

    expect(model.roomId).toBe("tabarnia-room");
    expect(model.dailyChallenge?.id).toBe("tabarnia-challenge-05");
    expect(model.dailyChallenge?.title).toBe("La Pirámide: Cumbre lógica");
    expect(model.currentUser).toEqual({ totalPoints: 136, roomRank: 3 });
    expect(model.memberPreviews).toHaveLength(4);
    expect(model.memberCount).toBe(5);
    expect(model.href).toBe("/salas/tabarnia-room");
  });

  it("uses the fallback artwork when a challenge has no specific artwork", () => {
    const room = {
      ...demoRoom,
      activeSeason: {
        ...demoRoom.activeSeason,
        scheduledChallenges: [demoRoom.activeSeason.scheduledChallenges[0]],
      },
    };

    expect(buildRoomCardModel(room, now).dailyChallenge?.imageSrc).toBe(ROOM_ART_FALLBACK);
  });

  it("keeps the room model available when there is no daily challenge", () => {
    const room = {
      ...demoRoom,
      activeSeason: { ...demoRoom.activeSeason, status: "finished" as const },
    };

    expect(buildRoomCardModel(room, now)).toMatchObject({
      roomId: "tabarnia-room",
      dailyChallenge: null,
      memberCount: 5,
    });
  });
});
