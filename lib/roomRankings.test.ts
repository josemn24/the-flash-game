import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getDailyLeaderboard, getRoomLeaderboard } from "@/lib/roomRankings";
import type { Room } from "@/types/game";

function roomWithMembers(members: Room["members"]): Room {
  return { ...demoRoom, members };
}

describe("room rankings", () => {
  it("ranks members by accumulated room points", () => {
    expect(
      getRoomLeaderboard(demoRoom).map((entry) => [entry.rank, entry.memberId, entry.points]),
    ).toEqual([
      [1, "ches", 184],
      [2, "marta", 161],
      [3, "player", 136],
      [4, "alex", 119],
      [5, "laura", 98],
    ]);
  });

  it("ranks members by the selected daily challenge, independently of total points", () => {
    expect(
      getDailyLeaderboard(demoRoom, "tabarnia-flash-01").map((entry) => [
        entry.rank,
        entry.memberId,
        entry.points,
      ]),
    ).toEqual([
      [1, "ches", 54],
      [2, "marta", 47],
      [3, "player", 42],
      [4, "alex", 38],
      [5, "laura", 0],
    ]);
  });

  it("uses zero points for members without a result", () => {
    const room = roomWithMembers([
      {
        id: "player",
        name: "Jugador",
        initials: "TÚ",
        totalPoints: 20,
        challengeResults: {},
      },
      {
        id: "ches",
        name: "CHES",
        initials: "CH",
        totalPoints: 10,
        challengeResults: {
          "daily-challenge": { points: 12, completed: true },
        },
      },
    ]);

    expect(getDailyLeaderboard(room, "daily-challenge")[1]).toMatchObject({
      memberId: "player",
      points: 0,
      completed: false,
    });
  });

  it("breaks ties deterministically by member id", () => {
    const room = roomWithMembers([
      {
        id: "zeta",
        name: "Zeta",
        initials: "ZE",
        totalPoints: 50,
        challengeResults: {},
      },
      {
        id: "alpha",
        name: "Alpha",
        initials: "AL",
        totalPoints: 50,
        challengeResults: {},
      },
    ]);

    expect(getRoomLeaderboard(room).map((entry) => entry.memberId)).toEqual(["alpha", "zeta"]);
  });
});
