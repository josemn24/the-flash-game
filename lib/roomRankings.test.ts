import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getRoomHistory } from "@/data/roomHistory";
import { getDailyLeaderboard, getHistoryLeaderboard, getRoomLeaderboard } from "@/lib/roomRankings";
import type { Room } from "@/types/game";

function roomWithMembers(members: Room["members"]): Room {
  return { ...demoRoom, members };
}

describe("room rankings", () => {
  it("ranks members by accumulated room points", () => {
    expect(
      getRoomLeaderboard(demoRoom).map((entry) => [entry.rank, entry.memberId, entry.flashPoints]),
    ).toEqual([
      [1, "ches", 242],
      [2, "marta", 225],
      [3, "player", 169],
      [4, "alex", 158],
      [5, "laura", 98],
    ]);
    expect(getRoomLeaderboard(demoRoom)[0].avatarSrc).toBe("/flash-pop/avatars/ches.jpeg");
  });

  it("ranks members by the selected daily challenge, independently of total points", () => {
    expect(
      getDailyLeaderboard(demoRoom, "tabarnia-flash-01").map((entry) => [
        entry.rank,
        entry.memberId,
        entry.flashPoints,
      ]),
    ).toEqual([
      [1, "ches", 54],
      [2, "marta", 47],
      [3, "player", 42],
      [4, "alex", 38],
    ]);
  });

  it("ranks historical snapshots without changing current room results", () => {
    const entries = getRoomHistory(demoRoom.id);

    expect(getHistoryLeaderboard(demoRoom, entries[2])[0]).toMatchObject({
      memberId: "ches",
      flashPoints: 38,
    });
    expect(getHistoryLeaderboard(demoRoom, entries[1])[0]).toMatchObject({
      memberId: "marta",
      flashPoints: 60,
    });
    expect(getHistoryLeaderboard(demoRoom, entries[0]).map((entry) => entry.memberId)).toEqual([
      "ches",
      "marta",
      "alex",
      "player",
    ]);
    expect(getDailyLeaderboard(demoRoom, "tabarnia-challenge-05")).toHaveLength(4);
  });

  it("excludes members without a completed result from the daily ranking", () => {
    const room = roomWithMembers([
      {
        id: "player",
        name: "Jugador",
        initials: "TÚ",
        totalFlashPoints: 20,
        challengeResults: {},
      },
      {
        id: "ches",
        name: "CHES",
        initials: "CH",
        totalFlashPoints: 10,
        challengeResults: {
          "daily-challenge": { flashPoints: 12, completed: true },
        },
      },
    ]);

    expect(getDailyLeaderboard(room, "daily-challenge")).toEqual([
      expect.objectContaining({
        rank: 1,
        memberId: "ches",
        flashPoints: 12,
        completed: true,
      }),
    ]);
  });

  it("breaks ties deterministically by member id", () => {
    const room = roomWithMembers([
      {
        id: "zeta",
        name: "Zeta",
        initials: "ZE",
        totalFlashPoints: 50,
        challengeResults: {},
      },
      {
        id: "alpha",
        name: "Alpha",
        initials: "AL",
        totalFlashPoints: 50,
        challengeResults: {},
      },
    ]);

    const ranking = getRoomLeaderboard(room);
    expect(ranking.map((entry) => entry.memberId)).toEqual(["alpha", "zeta"]);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 1]);
  });
});
