import { describe, expect, it } from "vitest";
import { QUESTION_FORMAT_CATALOG } from "@/features/question-formats/catalog";
import {
  DEMO_REFERENCE_TIME,
  demoIdentity,
  playerRouteAliases,
  roomRouteAliases,
  scheduledChallengeRouteAliases,
} from "@/data/mock/constants";
import { deterministicMockUuid, mockId } from "@/data/mock/identity";
import {
  normalizeLegacyQuestionFixture,
  reconstructLegacyQuestion,
} from "@/data/mock/questionFixtures";
import {
  resolvePlayerRouteKey,
  resolveRoomRouteKey,
  resolveScheduledChallengeRouteKey,
  selectChallengeRanking,
  selectOpenScheduledChallenge,
  selectRoomHistory,
  selectSeasonRanking,
} from "@/data/mock/selectors";
import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";
import { validateMockDomainStore } from "@/data/mock/validate";

const uuidV5Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("normalized mock domain store", () => {
  it("uses deterministic, unique UUID v5 IDs and resolves every public alias", () => {
    expect(deterministicMockUuid("player", "player")).toBe(
      deterministicMockUuid("player", "player"),
    );
    expect(deterministicMockUuid("player", "player")).toBe("e8687082-dea5-5595-b23a-197915c32796");
    expect(deterministicMockUuid("player", "player")).not.toBe(
      deterministicMockUuid("room", "player"),
    );
    expect(Object.values(playerRouteAliases).every((id) => uuidV5Pattern.test(id))).toBe(true);
    expect(resolveRoomRouteKey("tabarnia-room")).toBe(roomRouteAliases["tabarnia-room"]);
    for (const [routeKey, id] of Object.entries(playerRouteAliases)) {
      expect(resolvePlayerRouteKey(routeKey)).toBe(id);
    }
    for (const [routeKey, id] of Object.entries(scheduledChallengeRouteAliases)) {
      expect(resolveScheduledChallengeRouteKey(routeKey)).toBe(id);
    }
    expect(resolveRoomRouteKey("unknown")).toBeNull();
  });

  it("passes all relational and scoring integrity rules", () => {
    expect(validateMockDomainStore()).toBe(true);
    expect(mockDomainStore.roomInvitations).toEqual([]);
    expect(mockDomainStore.scheduledChallenges).toHaveLength(6);
    expect(mockDomainStore.attempts).toHaveLength(23);
    expect(mockDomainStore.attempts.every((attempt) => attempt.attemptNumber === 1)).toBe(true);
    const unscheduledDefinition = mockDomainStore.challengeDefinitions.find(
      ({ slug }) => slug === "connections-challenge-definition",
    );
    const unscheduledVersion = mockDomainStore.challengeVersions.find(
      ({ challengeDefinitionId }) => challengeDefinitionId === unscheduledDefinition?.id,
    );
    expect(unscheduledVersion?.status).toBe("published");
    expect(
      mockDomainStore.scheduledChallenges.some(
        ({ challengeVersionId }) => challengeVersionId === unscheduledVersion?.id,
      ),
    ).toBe(false);
  });

  it("stores 105 versioned questions and supports all 31 current contracts", () => {
    expect(mockDomainStore.questionDefinitions).toHaveLength(105);
    expect(mockDomainStore.questionVersions).toHaveLength(105);
    expect(Object.values(QUESTION_FORMAT_CATALOG)).toHaveLength(31);
    for (const format of Object.values(QUESTION_FORMAT_CATALOG)) {
      expect(() => normalizeLegacyQuestionFixture(format.examples[0].question)).not.toThrow();
    }
    for (const version of mockDomainStore.questionVersions) {
      expect(reconstructLegacyQuestion(version.id)?.id).toBeTruthy();
    }
  });

  it("keeps answer material out of public question payloads", () => {
    const serializedPublicPayloads = JSON.stringify(
      mockDomainStore.questionVersions.map((version) => version.publicPayload),
    );
    expect(serializedPublicPayloads).not.toContain('"correctAnswer"');
    expect(serializedPublicPayloads).not.toContain('"acceptedAnswers"');
    expect(serializedPublicPayloads).not.toContain('"correctMatchId"');
    expect(serializedPublicPayloads).not.toContain('"correctCategory"');
    expect(serializedPublicPayloads).not.toContain('"solutionPaths"');
    expect(serializedPublicPayloads).not.toContain('"referenceSolution"');
  });

  it("derives the reconciled season totals and five closed history entries", () => {
    const seasonId = mockId.season("tabarnia-season-1");
    expect(
      selectSeasonRanking(seasonId).map((entry) => [
        mockDomainStore.players.find((player) => player.id === entry.playerId)?.displayName,
        entry.points,
      ]),
    ).toEqual([
      ["Dark", 242],
      ["Jackobo", 225],
      ["Kike", 169],
      ["Rielbe", 158],
      ["Palmera", 98],
    ]);
    const history = selectRoomHistory(roomRouteAliases["tabarnia-room"]);
    expect(history).toHaveLength(5);
    expect(history.every(({ scheduledChallenge }) => scheduledChallenge.status === "closed")).toBe(
      true,
    );
  });

  it("selects challenge 06 explicitly from its open window", () => {
    expect(
      selectOpenScheduledChallenge(
        mockId.season("tabarnia-season-1"),
        new Date(DEMO_REFERENCE_TIME),
      )?.id,
    ).toBe(scheduledChallengeRouteAliases["tabarnia-challenge-06"]);
    expect(
      selectOpenScheduledChallenge(
        mockId.season("tabarnia-season-1"),
        new Date("2026-09-21T00:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("excludes superadmin, test and invalidated attempts and shares positions on ties", () => {
    const challengeId = scheduledChallengeRouteAliases["tabarnia-flash-01"];
    const playerAttempt = mockDomainStore.attempts.find(
      (attempt) =>
        attempt.scheduledChallengeId === challengeId &&
        attempt.playerId === playerRouteAliases.player,
    );
    if (!playerAttempt) throw new Error("Missing base attempt.");
    const testAttempt = {
      ...playerAttempt,
      id: mockId.attempt("test-superadmin"),
      playerId: demoIdentity.superadminPlayerId,
      kind: "test" as const,
      score: 100,
    };
    const invalidatedAttempt = {
      ...playerAttempt,
      id: mockId.attempt("invalidated-player"),
      status: "invalidated" as const,
      score: 100,
    };
    const tieAttempt = { ...playerAttempt, score: 54 };
    const store = {
      ...mockDomainStore,
      attempts: [
        ...mockDomainStore.attempts.filter((attempt) => attempt.id !== playerAttempt.id),
        tieAttempt,
        testAttempt,
        invalidatedAttempt,
      ],
    } satisfies MockDomainStore;
    const ranking = selectChallengeRanking(challengeId, store);
    expect(ranking.slice(0, 2).map(({ rank }) => rank)).toEqual([1, 1]);
    expect(ranking.some(({ playerId }) => playerId === demoIdentity.superadminPlayerId)).toBe(
      false,
    );
    expect(ranking.find(({ playerId }) => playerId === playerRouteAliases.player)?.points).toBe(54);
  });
});
