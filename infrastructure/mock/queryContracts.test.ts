import { describe, expect, it } from "vitest";
import type { ChallengeQueries, RoomQueries } from "@/application/queries";
import {
  DEMO_REFERENCE_TIME,
  demoIdentity,
  playerRouteAliases,
  scheduledChallengeRouteAliases,
} from "@/data/mock/constants";
import { mockDomainStore } from "@/data/mock/store";
import type { DomainStore } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { MockChallengeQueries } from "./challengeQueries";
import { MockCurrentViewerProvider } from "./currentViewer";
import { MockRoomQueries } from "./roomQueries";

const ownerContext: QueryContext = {
  viewerId: demoIdentity.currentPlayerId,
  now: DEMO_REFERENCE_TIME,
};

function withStore(changes: Partial<DomainStore>): DomainStore {
  return { ...mockDomainStore, ...changes };
}

function roomContract(queries: RoomQueries) {
  it("returns null for unknown or inaccessible rooms and members", async () => {
    await expect(queries.getDetail("missing-room", ownerContext)).resolves.toBeNull();
    await expect(
      queries.getDetail("tabarnia-room", {
        ...ownerContext,
        viewerId: demoIdentity.superadminPlayerId,
      }),
    ).resolves.toBeNull();
    await expect(
      queries.getMemberDetail("tabarnia-room", "missing-member", ownerContext),
    ).resolves.toBeNull();
  });

  it("allows active members to read room views", async () => {
    const [cards, detail, settings, ranking, member, history] = await Promise.all([
      queries.listCards(ownerContext),
      queries.getDetail("tabarnia-room", ownerContext),
      queries.getSettings("tabarnia-room", ownerContext),
      queries.getRanking("tabarnia-room", ownerContext),
      queries.getMemberDetail("tabarnia-room", "ches", ownerContext),
      queries.listHistory("tabarnia-room", ownerContext),
    ]);

    expect(cards).toHaveLength(1);
    expect(detail?.title).toBe("Tabarnia");
    expect(settings?.currentUserId).toBe("player");
    expect(ranking?.entries[0]?.name).toBe("Dark");
    expect(member?.member.name).toBe("Dark");
    expect(history?.entries).toHaveLength(5);
  });

  it("serializes room DTOs without authentication or canonical private payloads", async () => {
    const values = await Promise.all([
      queries.listCards(ownerContext),
      queries.getDetail("tabarnia-room", ownerContext),
      queries.getSettings("tabarnia-room", ownerContext),
      queries.getRanking("tabarnia-room", ownerContext),
      queries.getMemberDetail("tabarnia-room", "ches", ownerContext),
      queries.listHistory("tabarnia-room", ownerContext),
    ]);
    const serialized = JSON.stringify(values);

    expect(serialized).not.toContain("authUserId");
    expect(serialized).not.toContain("platformRoleAssignments");
    expect(serialized).not.toContain("privatePayload");
    expect(serialized).not.toContain("solutionPayload");
    expect(serialized).not.toContain("superadmin");
  });
}

function challengeContract(queries: ChallengeQueries) {
  it("separates roomless previews from competitive room access", async () => {
    await expect(
      queries.getPlayable("tabarnia-challenge-06", null, ownerContext),
    ).resolves.toMatchObject({ roomContext: undefined });
    await expect(
      queries.getPlayable("tabarnia-challenge-06", "tabarnia-room", ownerContext),
    ).resolves.toMatchObject({
      roomContext: { attemptStatus: "available", memberId: "player" },
    });
    await expect(
      queries.getPlayable("tabarnia-challenge-06", "missing-room", ownerContext),
    ).resolves.toBeNull();
    await expect(queries.getPlayable("missing-challenge", null, ownerContext)).resolves.toBeNull();
  });

  it("returns the canonical viewer once and no invented peers for challenge 06", async () => {
    const lobby = await queries.getFlashPopLobby(ownerContext);

    expect(lobby.currentViewer).toMatchObject({ id: "player", name: "Kike" });
    expect(lobby.secondary.socialSnapshot.currentPlayer.id).toBe("player");
    expect(lobby.secondary.socialSnapshot.peers).toEqual([]);
    expect(lobby.secondary.socialSnapshot.players).toHaveLength(5);
  });
}

describe("MockRoomQueries contract", () => {
  roomContract(new MockRoomQueries(mockDomainStore));

  it("allows spectators to read the room while excluding them from competitive play", async () => {
    const memberships = mockDomainStore.roomMemberships.map((membership) =>
      membership.playerId === demoIdentity.currentPlayerId
        ? { ...membership, role: "spectator" as const }
        : membership,
    );
    const store = withStore({ roomMemberships: memberships });

    await expect(
      new MockRoomQueries(store).getDetail("tabarnia-room", ownerContext),
    ).resolves.not.toBeNull();
    await expect(
      new MockChallengeQueries(store).getPlayable(
        "tabarnia-challenge-06",
        "tabarnia-room",
        ownerContext,
      ),
    ).resolves.toBeNull();
  });

  it("grants the same read contract to owners and room admins", async () => {
    const queries = new MockRoomQueries(mockDomainStore);
    const adminContext = { ...ownerContext, viewerId: playerRouteAliases.ches };

    await expect(queries.getDetail("tabarnia-room", ownerContext)).resolves.not.toBeNull();
    await expect(queries.getDetail("tabarnia-room", adminContext)).resolves.not.toBeNull();
  });

  it("keeps former competitors in historical rankings but denies them room access", async () => {
    const memberships = mockDomainStore.roomMemberships.map((membership) =>
      membership.playerId === demoIdentity.currentPlayerId
        ? {
            ...membership,
            status: "left" as const,
            endedAt: DEMO_REFERENCE_TIME,
          }
        : membership,
    );
    const queries = new MockRoomQueries(withStore({ roomMemberships: memberships }));

    await expect(queries.getDetail("tabarnia-room", ownerContext)).resolves.toBeNull();
    const ranking = await queries.getRanking("tabarnia-room", {
      ...ownerContext,
      viewerId: playerRouteAliases.ches,
    });
    expect(ranking?.entries.some(({ memberId }) => memberId === "player")).toBe(true);
  });

  it("counts started attempts even when they did not finish", async () => {
    const scheduleId = scheduledChallengeRouteAliases["tabarnia-challenge-05"];
    const target = mockDomainStore.attempts.find(
      (attempt) => attempt.scheduledChallengeId === scheduleId,
    );
    if (!target) throw new Error("Expected a challenge 05 attempt fixture.");
    const attempts = mockDomainStore.attempts.map((attempt) =>
      attempt.id === target.id
        ? {
            ...attempt,
            status: "in_progress" as const,
            outcome: null,
            completedAt: null,
            score: null,
          }
        : attempt,
    );
    const history = await new MockRoomQueries(withStore({ attempts })).listHistory(
      "tabarnia-room",
      ownerContext,
    );
    const entry = history?.entries.find(
      ({ challengeId }) => challengeId === "tabarnia-challenge-05",
    );

    expect(entry?.playerCount).toBe(4);
    expect(history?.rankings["tabarnia-challenge-05"]).toHaveLength(3);
  });

  it("supports an empty history and closed publications without participants", async () => {
    const withoutClosed = withStore({
      scheduledChallenges: mockDomainStore.scheduledChallenges.filter(
        ({ status }) => status !== "closed",
      ),
    });
    await expect(
      new MockRoomQueries(withoutClosed).listHistory("tabarnia-room", ownerContext),
    ).resolves.toMatchObject({ entries: [] });

    const withoutAttempts = await new MockRoomQueries(withStore({ attempts: [] })).listHistory(
      "tabarnia-room",
      ownerContext,
    );
    expect(withoutAttempts?.entries.every(({ playerCount }) => playerCount === 0)).toBe(true);
  });

  it("excludes invalidated attempts and cancelled publications and preserves tied ranks", async () => {
    const scheduleId = scheduledChallengeRouteAliases["tabarnia-challenge-05"];
    const challengeAttempts = mockDomainStore.attempts.filter(
      (attempt) => attempt.scheduledChallengeId === scheduleId,
    );
    const [first, second] = challengeAttempts;
    if (!first || !second || first.score === null) {
      throw new Error("Expected two scored challenge 05 attempts.");
    }

    const tiedAttempts = mockDomainStore.attempts.map((attempt) =>
      attempt.id === second.id ? { ...attempt, score: first.score } : attempt,
    );
    const tied = await new MockRoomQueries(withStore({ attempts: tiedAttempts })).getHistoryDetail(
      "tabarnia-room",
      "tabarnia-challenge-05",
      ownerContext,
    );
    const tiedRows = tied?.ranking.filter(({ flashPoints }) => flashPoints === first.score);
    expect(tiedRows).toHaveLength(2);
    expect(new Set(tiedRows?.map(({ rank }) => rank)).size).toBe(1);

    const invalidatedAttempts = mockDomainStore.attempts.map((attempt) =>
      attempt.id === first.id
        ? { ...attempt, status: "invalidated" as const, outcome: null, score: null }
        : attempt,
    );
    const invalidated = await new MockRoomQueries(
      withStore({ attempts: invalidatedAttempts }),
    ).getHistoryDetail("tabarnia-room", "tabarnia-challenge-05", ownerContext);
    expect(invalidated?.ranking).toHaveLength(challengeAttempts.length - 1);

    const cancelledSchedules = mockDomainStore.scheduledChallenges.map((schedule) =>
      schedule.id === scheduleId
        ? {
            ...schedule,
            status: "cancelled" as const,
            cancelledAt: DEMO_REFERENCE_TIME,
            resultsLockedAt: null,
          }
        : schedule,
    );
    await expect(
      new MockRoomQueries(withStore({ scheduledChallenges: cancelledSchedules })).getHistoryDetail(
        "tabarnia-room",
        "tabarnia-challenge-05",
        ownerContext,
      ),
    ).resolves.toBeNull();
  });
});

describe("MockChallengeQueries contract", () => {
  challengeContract(new MockChallengeQueries(mockDomainStore));

  it("projects terminal, in-progress and failed competitive attempts", async () => {
    const completed = await new MockChallengeQueries(mockDomainStore).getPlayable(
      "tabarnia-challenge-05",
      "tabarnia-room",
      ownerContext,
    );
    expect(completed?.roomContext?.attemptStatus).toBe("completed");

    const playerAttempt = mockDomainStore.attempts.find(
      (attempt) =>
        attempt.scheduledChallengeId === scheduledChallengeRouteAliases["tabarnia-challenge-05"] &&
        attempt.playerId === ownerContext.viewerId,
    );
    if (!playerAttempt) throw new Error("Expected the viewer challenge 05 attempt fixture.");

    const inProgress = await new MockChallengeQueries(
      withStore({
        attempts: mockDomainStore.attempts.map((attempt) =>
          attempt.id === playerAttempt.id
            ? { ...attempt, status: "in_progress" as const, outcome: null }
            : attempt,
        ),
      }),
    ).getPlayable("tabarnia-challenge-05", "tabarnia-room", ownerContext);
    expect(inProgress?.roomContext?.attemptStatus).toBe("inProgress");

    const expired = await new MockChallengeQueries(
      withStore({
        attempts: mockDomainStore.attempts.map((attempt) =>
          attempt.id === playerAttempt.id
            ? { ...attempt, status: "expired" as const, outcome: null }
            : attempt,
        ),
      }),
    ).getPlayable("tabarnia-challenge-05", "tabarnia-room", ownerContext);
    expect(expired?.roomContext?.attemptStatus).toBe("notCompleted");
  });
});

describe("MockCurrentViewerProvider", () => {
  it("projects the injected viewer without exposing auth identity", async () => {
    const viewer = await new MockCurrentViewerProvider(
      mockDomainStore,
      demoIdentity.currentPlayerId,
    ).getCurrentViewer();

    expect(viewer).toEqual({
      playerId: demoIdentity.currentPlayerId,
      id: "player",
      name: "Kike",
      avatarSrc: "/flash-pop/avatars/player.jpeg",
    });
    expect(JSON.stringify(viewer)).not.toContain("authUserId");
  });
});
