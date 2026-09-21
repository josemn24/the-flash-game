import { describe, expect, it } from "vitest";
import { demoRoom } from "@/data/demoRoom";
import { getDailyChallenge, getDailyChallengeDateKey } from "@/lib/dailyChallenge";
import type { Room } from "@/types/game";

const midday = new Date("2026-09-06T12:00:00.000Z");

function roomWithChallenges(
  room: Room,
  scheduledChallenges: Room["activeSeason"]["scheduledChallenges"],
): Room {
  return {
    ...room,
    activeSeason: {
      ...room.activeSeason,
      scheduledChallenges,
    },
  };
}

describe("getDailyChallenge", () => {
  it("returns a stable challenge for the same room and local date", () => {
    expect(getDailyChallenge(demoRoom, midday)?.id).toBe(
      getDailyChallenge(demoRoom, new Date("2026-09-06T20:00:00.000Z"))?.id,
    );
  });

  it("can select a different challenge on a different local date", () => {
    expect(getDailyChallenge(demoRoom, midday)?.id).not.toBe(
      getDailyChallenge(demoRoom, new Date("2026-09-07T12:00:00.000Z"))?.id,
    );
  });

  it("uses Europe/Madrid to determine the daily boundary", () => {
    expect(getDailyChallengeDateKey(new Date("2026-09-06T21:59:59.999Z"))).toBe("2026-09-06");
    expect(getDailyChallengeDateKey(new Date("2026-09-06T22:00:00.000Z"))).toBe("2026-09-07");
  });

  it("does not depend on the current member when selecting a room challenge", () => {
    const roomWithDifferentMembers = { ...demoRoom, members: demoRoom.members.slice(0, 1) };

    expect(getDailyChallenge(roomWithDifferentMembers, midday)?.id).toBe(
      getDailyChallenge(demoRoom, midday)?.id,
    );
  });

  it("excludes placeholders, unknown definitions, future challenges and expired challenges", () => {
    const validChallenge = demoRoom.activeSeason.scheduledChallenges.find(
      (challenge) => challenge.id === "tabarnia-flash-01",
    );
    if (!validChallenge || !("challengeDefinitionId" in validChallenge)) {
      throw new Error("Expected the demo flash challenge to exist.");
    }

    const candidates = roomWithChallenges(demoRoom, [
      validChallenge,
      {
        ...validChallenge,
        id: "unknown-definition",
        challengeDefinitionId: "missing-definition",
      },
      {
        id: "future-challenge",
        number: 10,
        seasonId: demoRoom.activeSeason.id,
        challengeDefinitionId: validChallenge.challengeDefinitionId,
        availableFrom: "2026-09-06T22:00:00.000Z",
        availableUntil: "2026-09-20T21:59:59.999Z",
      },
      {
        id: "expired-challenge",
        number: 11,
        seasonId: demoRoom.activeSeason.id,
        challengeDefinitionId: validChallenge.challengeDefinitionId,
        availableFrom: "2026-08-01T22:00:00.000Z",
        availableUntil: "2026-09-05T21:59:59.999Z",
      },
      {
        id: "placeholder-challenge",
        number: 12,
        seasonId: demoRoom.activeSeason.id,
        title: "Próximamente",
        subtitle: "Sin definición",
        availableFrom: "2026-09-05T22:00:00.000Z",
        availableUntil: "2026-09-20T21:59:59.999Z",
      },
    ]);

    expect(getDailyChallenge(candidates, midday)?.id).toBe(validChallenge.id);
  });

  it("returns null when no eligible challenge exists", () => {
    const room = roomWithChallenges(demoRoom, []);

    expect(getDailyChallenge(room, midday)).toBeNull();
  });

  it("returns null when the active season is finished", () => {
    const room = {
      ...demoRoom,
      activeSeason: { ...demoRoom.activeSeason, status: "finished" as const },
    };

    expect(getDailyChallenge(room, midday)).toBeNull();
  });
});
