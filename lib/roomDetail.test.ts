import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getDailyChallenge } from "@/test-utils/legacy/dailyChallenge";
import {
  applyRoomChallengeResult,
  buildRoomDetailModel,
  getRoomById,
} from "@/test-utils/legacy/roomDetail";

const now = new Date("2026-09-06T12:00:00.000Z");
const completion = (flashPoints: number) => ({
  roomId: "tabarnia-room",
  challengeId: "tabarnia-challenge-06",
  flashPoints,
  completed: true,
  playedAt: "2026-09-06T12:00:00.000Z",
  answers: [],
});

describe("room detail model", () => {
  it("builds Tabarnia with the shared daily challenge and both rankings", () => {
    const model = buildRoomDetailModel(demoRoom, now);
    const dailyChallenge = getDailyChallenge(demoRoom, now);

    expect(model.roomId).toBe("tabarnia-room");
    expect(model.title).toBe("Tabarnia");
    expect(model.currentUser).toMatchObject({
      id: "player",
      name: "Kike",
      totalFlashPoints: 169,
      roomRank: 3,
      dailyFlashPoints: 0,
      dailyCompleted: false,
    });
    expect(model.dailyChallenge?.id).toBe(dailyChallenge?.id);
    expect(model.dailyChallenge?.href).toBe("/desafios/tabarnia-challenge-06?roomId=tabarnia-room");
    expect(model.dailyChallenge?.endsAt).toBe("2026-09-20T22:00:00.000Z");
    expect(model.roomLeaderboard[0]).toMatchObject({
      memberId: "ches",
      flashPoints: 242,
      rank: 1,
    });
    expect(model.dailyLeaderboard).toHaveLength(0);
  });

  it("keeps the room rankings available without a daily challenge", () => {
    const room = {
      ...demoRoom,
      activeSeason: { ...demoRoom.activeSeason, status: "finished" as const },
    };

    const model = buildRoomDetailModel(room, now);

    expect(model.dailyChallenge).toBeNull();
    expect(model.dailyLeaderboard).toEqual([]);
    expect(model.roomLeaderboard).toHaveLength(demoRoom.members.length);
  });

  it("returns no room for an unknown id", () => {
    expect(getRoomById("unknown-room")).toBeUndefined();
  });

  it("replaces the current user's daily result and recalculates both rankings", () => {
    const model = buildRoomDetailModel(demoRoom, now);
    const updated = applyRoomChallengeResult(model, completion(88));

    expect(updated.currentUser).toMatchObject({
      totalFlashPoints: 257,
      dailyFlashPoints: 88,
      dailyCompleted: true,
      roomRank: 1,
    });
    expect(updated.roomLeaderboard[0]).toMatchObject({
      memberId: "player",
      flashPoints: 257,
      rank: 1,
    });
    expect(updated.dailyLeaderboard[0]).toMatchObject({
      memberId: "player",
      flashPoints: 88,
      completed: true,
      rank: 1,
    });

    const replayed = applyRoomChallengeResult(updated, completion(50));

    expect(replayed.currentUser.totalFlashPoints).toBe(219);
    expect(replayed.currentUser.dailyFlashPoints).toBe(50);
  });
});
