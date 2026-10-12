import { describe, expect, it } from "vitest";
import type {
  CompetitiveChallengeQueries,
  DemoChallengeQueries,
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import {
  DEMO_REFERENCE_TIME,
  demoIdentity,
  playerRouteAliases,
  scheduledChallengeRouteAliases,
} from "@/data/mock/constants";
import { utc } from "@/data/mock/identity";
import { mockDomainStore } from "@/data/mock/store";
import type { DomainStore } from "@/types/domain";
import type { QueryContext } from "@/types/view-models";
import { getPlayerRouteKey } from "@/data/mock/selectors";
import { defineRoomReadPublicContract } from "@/test-utils/roomReadContract";
import {
  MockChallengeReadProjection,
  MockCompetitiveChallengeQueries,
  MockDemoChallengeQueries,
} from "./challengeQueries";
import { MockCurrentViewerProvider } from "./currentViewer";
import { createMockRoomReadCapabilities } from "@/test-utils/mockRoom";

const ownerContext: QueryContext = {
  viewer: {
    playerId: demoIdentity.currentPlayerId,
    id: getPlayerRouteKey(demoIdentity.currentPlayerId)!,
    name: "Kike",
    avatarSrc: "/flash-pop/avatars/player.jpeg",
  },
  now: DEMO_REFERENCE_TIME,
};

// The intersection is a test subject assembled from concrete capabilities; it
// is not exported as an application or infrastructure adapter.
type RoomReadCapabilities = RoomHistoryQueries &
  RoomLobbyQueries &
  RoomMemberDetailQueries &
  RoomRankingQueries &
  RoomSettingsQueries;
// Demo and competitive adapters are composed here only to exercise the shared contract.
type ChallengeReadCapabilities = DemoChallengeQueries & CompetitiveChallengeQueries;

function withStore(changes: Partial<DomainStore>): DomainStore {
  return { ...mockDomainStore, ...changes };
}

function createChallengeReadCapabilities(store: DomainStore): ChallengeReadCapabilities {
  const projection = new MockChallengeReadProjection(store);
  const demo = new MockDemoChallengeQueries(projection);
  const competitive = new MockCompetitiveChallengeQueries(projection);
  return {
    getPreview: (challengeKey, context) => demo.getPreview(challengeKey, context),
    getFlashPopLobby: (context) => demo.getFlashPopLobby(context),
    getPlayable: (roomKey, challengeKey, context) =>
      competitive.getPlayable(roomKey, challengeKey, context),
  };
}

function roomContract(queries: RoomReadCapabilities) {
  it("returns null for unknown or inaccessible rooms and members", async () => {
    await expect(queries.getDetail("missing-room", ownerContext)).resolves.toBeNull();
    await expect(
      queries.getDetail("tabarnia-room", {
        ...ownerContext,
        viewer: {
          ...ownerContext.viewer,
          playerId: demoIdentity.superadminPlayerId,
          id: "superadmin",
        },
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

defineRoomReadPublicContract("Mock room read public contract", async () => {
  const queries = createMockRoomReadCapabilities(mockDomainStore);
  return Promise.all([
    queries.listCards(ownerContext),
    queries.getDetail("tabarnia-room", ownerContext),
    queries.getSettings("tabarnia-room", ownerContext),
    queries.getRanking("tabarnia-room", ownerContext),
    queries.getMemberDetail("tabarnia-room", "ches", ownerContext),
    queries.listHistory("tabarnia-room", ownerContext),
  ]);
});

function challengeContract(queries: ChallengeReadCapabilities) {
  it("separates roomless previews from competitive room access", async () => {
    await expect(queries.getPreview("tabarnia-challenge-06", ownerContext)).resolves.toMatchObject({
      roomContext: undefined,
    });
    await expect(
      queries.getPlayable("tabarnia-room", "tabarnia-challenge-06", ownerContext),
    ).resolves.toMatchObject({
      roomContext: {
        availabilityStatus: "available",
        attemptStatus: "available",
        memberId: "player",
      },
    });
    await expect(
      queries.getPlayable("missing-room", "tabarnia-challenge-06", ownerContext),
    ).resolves.toBeNull();
    await expect(queries.getPreview("missing-challenge", ownerContext)).resolves.toBeNull();
  });

  it("returns the canonical viewer once and no invented peers for challenge 06", async () => {
    const lobby = await queries.getFlashPopLobby(ownerContext);

    expect(lobby.currentViewer).toMatchObject({ id: "player", name: "Kike" });
    expect(lobby.secondary.socialSnapshot.currentPlayer.id).toBe("player");
    expect(lobby.secondary.socialSnapshot.peers).toEqual([]);
    expect(lobby.secondary.socialSnapshot.players).toHaveLength(5);
  });
}

describe("Mock room read capabilities contract", () => {
  roomContract(createMockRoomReadCapabilities(mockDomainStore));

  it("allows spectators to read the room while excluding them from competitive play", async () => {
    const memberships = mockDomainStore.roomMemberships.map((membership) =>
      membership.playerId === demoIdentity.currentPlayerId
        ? { ...membership, role: "spectator" as const }
        : membership,
    );
    const store = withStore({ roomMemberships: memberships });

    await expect(
      createMockRoomReadCapabilities(store).getDetail("tabarnia-room", ownerContext),
    ).resolves.not.toBeNull();
    await expect(
      new MockCompetitiveChallengeQueries(new MockChallengeReadProjection(store)).getPlayable(
        "tabarnia-room",
        "tabarnia-challenge-06",
        ownerContext,
      ),
    ).resolves.toBeNull();
    await expect(
      createMockRoomReadCapabilities(store).getMemberDetail(
        "tabarnia-room",
        "ches",
        ownerContext,
        "tabarnia-challenge-05",
      ),
    ).resolves.toBeNull();
  });

  it("projects historical Survival progress and seven Pyramid levels with locked metadata", async () => {
    const pyramidScheduleId = scheduledChallengeRouteAliases["tabarnia-challenge-05"];
    const pyramidItemIds = new Set(
      mockDomainStore.challengeItems
        .filter(
          (item) =>
            item.challengeVersionId ===
            mockDomainStore.scheduledChallenges.find(({ id }) => id === pyramidScheduleId)
              ?.challengeVersionId,
        )
        .filter((item) => item.position > 2)
        .map(({ id }) => id),
    );
    const partialAnswers = mockDomainStore.attemptAnswers.filter(
      (answer) => !pyramidItemIds.has(answer.challengeItemId),
    );
    const model = await createMockRoomReadCapabilities(
      withStore({ attemptAnswers: partialAnswers }),
    ).getMemberDetail("tabarnia-room", "ches", ownerContext, "tabarnia-challenge-05");

    expect(model?.reviewItems).toHaveLength(7);
    expect(model?.reviewItems.filter(({ status }) => status === "locked")).toHaveLength(5);
    expect(model?.reviewItems[6]?.question).toBeNull();
    expect(model?.reviewProgress).toMatchObject({ mode: "pyramid", levelsCleared: 2 });
  });

  it("grants the same read contract to owners and room admins", async () => {
    const queries = createMockRoomReadCapabilities(mockDomainStore);
    const adminContext = {
      ...ownerContext,
      viewer: { ...ownerContext.viewer, playerId: playerRouteAliases.ches, id: "ches" },
    };

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
    const queries = createMockRoomReadCapabilities(withStore({ roomMemberships: memberships }));

    await expect(queries.getDetail("tabarnia-room", ownerContext)).resolves.toBeNull();
    const ranking = await queries.getRanking("tabarnia-room", {
      ...ownerContext,
      viewer: { ...ownerContext.viewer, playerId: playerRouteAliases.ches, id: "ches" },
    });
    expect(ranking?.entries.some(({ memberId }) => memberId === "player")).toBe(true);
  });

  it("excludes history while a started attempt remains in progress", async () => {
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
    const history = await createMockRoomReadCapabilities(withStore({ attempts })).listHistory(
      "tabarnia-room",
      ownerContext,
    );
    const entry = history?.entries.find(
      ({ challengeId }) => challengeId === "tabarnia-challenge-05",
    );

    expect(entry).toBeUndefined();
    expect(history?.rankings["tabarnia-challenge-05"]).toBeUndefined();
  });

  it("supports an empty history and closed publications without participants", async () => {
    const withoutClosed = withStore({
      scheduledChallenges: mockDomainStore.scheduledChallenges.filter(
        ({ status }) => status !== "closed",
      ),
    });
    await expect(
      createMockRoomReadCapabilities(withoutClosed).listHistory("tabarnia-room", ownerContext),
    ).resolves.toMatchObject({ entries: [] });

    const withoutAttempts = await createMockRoomReadCapabilities(
      withStore({ attempts: [] }),
    ).listHistory("tabarnia-room", ownerContext);
    expect(withoutAttempts?.entries.every(({ playerCount }) => playerCount === 0)).toBe(true);
  });

  it("excludes invalidated attempts and applies the full challenge ranking comparator", async () => {
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
    const tied = await createMockRoomReadCapabilities(
      withStore({ attempts: tiedAttempts }),
    ).getHistoryDetail("tabarnia-room", "tabarnia-challenge-05", ownerContext);
    const tiedRows = tied?.ranking.filter(({ flashPoints }) => flashPoints === first.score);
    expect(tiedRows).toHaveLength(2);
    expect(new Set(tiedRows?.map(({ rank }) => rank)).size).toBe(2);

    const invalidatedAttempts = mockDomainStore.attempts.map((attempt) =>
      attempt.id === first.id
        ? { ...attempt, status: "invalidated" as const, outcome: null, score: null }
        : attempt,
    );
    const invalidated = await createMockRoomReadCapabilities(
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
      createMockRoomReadCapabilities(
        withStore({ scheduledChallenges: cancelledSchedules }),
      ).getHistoryDetail("tabarnia-room", "tabarnia-challenge-05", ownerContext),
    ).resolves.toBeNull();
  });
});

describe("Mock challenge read capabilities contract", () => {
  challengeContract(createChallengeReadCapabilities(mockDomainStore));

  it("projects completed and in-progress competitive attempts", async () => {
    const completed = await new MockCompetitiveChallengeQueries(
      new MockChallengeReadProjection(mockDomainStore),
    ).getPlayable("tabarnia-room", "tabarnia-challenge-05", ownerContext);
    expect(completed?.roomContext?.attemptStatus).toBe("completed");

    const playerAttempt = mockDomainStore.attempts.find(
      (attempt) =>
        attempt.scheduledChallengeId === scheduledChallengeRouteAliases["tabarnia-challenge-05"] &&
        attempt.playerId === ownerContext.viewer.playerId,
    );
    if (!playerAttempt) throw new Error("Expected the viewer challenge 05 attempt fixture.");

    const inProgress = await new MockCompetitiveChallengeQueries(
      new MockChallengeReadProjection(
        withStore({
          attempts: mockDomainStore.attempts.map((attempt) =>
            attempt.id === playerAttempt.id
              ? { ...attempt, status: "in_progress" as const, outcome: null }
              : attempt,
          ),
        }),
      ),
    ).getPlayable("tabarnia-room", "tabarnia-challenge-05", ownerContext);
    expect(inProgress?.roomContext?.attemptStatus).toBe("inProgress");

    const unavailable = await new MockCompetitiveChallengeQueries(
      new MockChallengeReadProjection(
        withStore({
          attempts: mockDomainStore.attempts.filter((attempt) => attempt.id !== playerAttempt.id),
        }),
      ),
    ).getPlayable("tabarnia-room", "tabarnia-challenge-05", {
      ...ownerContext,
      now: utc("2026-09-20T22:00:00.000Z"),
    });
    expect(unavailable?.roomContext).toMatchObject({
      availabilityStatus: "expired",
      attemptStatus: "available",
    });
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
