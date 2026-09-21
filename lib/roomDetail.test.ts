import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getDailyChallenge } from "@/lib/dailyChallenge";
import {
  applyRoomChallengeResult,
  buildRoomDetailModel,
  getRoomById,
} from "@/lib/roomDetail";

const now = new Date("2026-09-06T12:00:00.000Z");
const completion = (points: number) => ({
  roomId: "tabarnia-room",
  challengeId: "tabarnia-challenge-05",
  points,
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
      totalPoints: 136,
      roomRank: 3,
      dailyPoints: 0,
      dailyCompleted: false,
    });
    expect(model.dailyChallenge?.id).toBe(dailyChallenge?.id);
    expect(model.dailyChallenge?.href).toBe(
      "/desafios/tabarnia-challenge-05?roomId=tabarnia-room",
    );
    expect(model.dailyChallenge?.endsAt).toBe("2026-09-06T22:00:00.000Z");
    expect(model.roomLeaderboard[0]).toMatchObject({ memberId: "ches", points: 184, rank: 1 });
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
    const updated = applyRoomChallengeResult(model, completion(200));

    expect(updated.currentUser).toMatchObject({
      totalPoints: 336,
      dailyPoints: 200,
      dailyCompleted: true,
      roomRank: 1,
    });
    expect(updated.roomLeaderboard[0]).toMatchObject({ memberId: "player", points: 336, rank: 1 });
    expect(updated.dailyLeaderboard[0]).toMatchObject({
      memberId: "player",
      points: 200,
      completed: true,
      rank: 1,
    });

    const replayed = applyRoomChallengeResult(updated, completion(50));

    expect(replayed.currentUser.totalPoints).toBe(186);
    expect(replayed.currentUser.dailyPoints).toBe(50);
  });
});
