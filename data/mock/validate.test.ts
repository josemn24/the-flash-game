import { describe, expect, it } from "vitest";
import { mockId, utc } from "@/data/mock/identity";
import { mockDomainStore, type MockDomainStore } from "@/data/mock/store";
import { validateMockDomainStore } from "@/data/mock/validate";
import type { Attempt } from "@/types/domain";

function changed(patch: Partial<MockDomainStore>): MockDomainStore {
  return { ...mockDomainStore, ...patch };
}

function expectInvalid(store: MockDomainStore, message: string) {
  expect(() => validateMockDomainStore(store)).toThrow(message);
}

const baseAttempt = mockDomainStore.attempts[0]!;

function replaceBaseAttempt(replacement: Attempt) {
  return changed({
    attempts: mockDomainStore.attempts.map((attempt) =>
      attempt.id === baseAttempt.id ? replacement : attempt,
    ),
  });
}

describe("mock domain store negative integrity scenarios", () => {
  it("rejects unsupported content contract versions", () => {
    expectInvalid(
      changed({
        questionVersions: mockDomainStore.questionVersions.map((version, index) =>
          index === 0 ? { ...version, payloadSchemaVersion: 2 } : version,
        ),
      }),
      "unsupported payload schema version",
    );
    expectInvalid(
      changed({
        challengeVersions: mockDomainStore.challengeVersions.map((version, index) =>
          index === 0 ? { ...version, configSchemaVersion: 2 } : version,
        ),
      }),
      "unsupported config schema version",
    );
    expectInvalid(
      changed({
        challengeItems: mockDomainStore.challengeItems.map((item, index) =>
          index === 0 ? { ...item, configSchemaVersion: 2 } : item,
        ),
      }),
      "unsupported config schema version",
    );
  });

  it("rejects invalid invitation usage", () => {
    expectInvalid(
      changed({
        roomInvitations: [
          {
            id: mockId.roomInvitation("invalid-usage"),
            roomId: mockDomainStore.rooms[0]!.id,
            createdByPlayerId: mockDomainStore.players[0]!.id,
            role: "member",
            tokenHash: "invalid-usage",
            expiresAt: utc("2026-09-30T00:00:00.000Z"),
            revokedAt: null,
            maxUses: 1,
            useCount: 2,
            createdAt: utc("2026-09-01T00:00:00.000Z"),
            updatedAt: utc("2026-09-01T00:00:00.000Z"),
          },
        ],
      }),
      "exceeds its usage limit",
    );
  });

  it("rejects competitive attempts by spectators", () => {
    expectInvalid(
      changed({
        roomMemberships: mockDomainStore.roomMemberships.map((membership) =>
          membership.playerId === baseAttempt.playerId
            ? { ...membership, role: "spectator" as const }
            : membership,
        ),
      }),
      "has no eligible membership at start",
    );
  });

  it("rejects attempts started after membership ended", () => {
    expectInvalid(
      changed({
        roomMemberships: mockDomainStore.roomMemberships.map((membership) =>
          membership.playerId === baseAttempt.playerId
            ? {
                ...membership,
                status: "left" as const,
                endedAt: utc("2026-08-30T00:00:00.000Z"),
              }
            : membership,
        ),
      }),
      "has no eligible membership at start",
    );
  });

  it("rejects attempts attached to a cancelled publication", () => {
    expectInvalid(
      changed({
        scheduledChallenges: mockDomainStore.scheduledChallenges.map((schedule) =>
          schedule.id === baseAttempt.scheduledChallengeId
            ? {
                ...schedule,
                status: "cancelled" as const,
                cancelledAt: schedule.opensAt,
                resultsLockedAt: null,
              }
            : schedule,
        ),
      }),
      "has no eligible membership at start",
    );
  });

  it.each([
    ["in_progress", baseAttempt.completedAt, null],
    ["abandoned", null, baseAttempt.score],
    ["invalidated", null, baseAttempt.score],
  ] as const)("rejects incoherent %s attempts", (status, completedAt, score) => {
    expectInvalid(
      replaceBaseAttempt({ ...baseAttempt, status, completedAt, score }),
      "has incoherent status fields",
    );
  });

  it("rejects an answer from another challenge version", () => {
    const baseAnswer = mockDomainStore.attemptAnswers.find(
      ({ attemptId }) => attemptId === baseAttempt.id,
    )!;
    const foreignItem = mockDomainStore.challengeItems.find(
      (item) => item.challengeVersionId !== mockDomainStore.challengeItems[0]!.challengeVersionId,
    )!;
    expectInvalid(
      changed({
        attemptAnswers: mockDomainStore.attemptAnswers.map((answer) =>
          answer.id === baseAnswer.id ? { ...answer, challengeItemId: foreignItem.id } : answer,
        ),
      }),
      "outside its attempted challenge",
    );
  });

  it("rejects overlapping publication windows", () => {
    const [first, second] = mockDomainStore.scheduledChallenges;
    expectInvalid(
      changed({
        scheduledChallenges: mockDomainStore.scheduledChallenges.map((schedule) =>
          schedule.id === second!.id ? { ...schedule, opensAt: first!.opensAt } : schedule,
        ),
      }),
      "Overlapping schedules",
    );
  });

  it("rejects answer points above the challenge item maximum", () => {
    const answer = mockDomainStore.attemptAnswers[0]!;
    const item = mockDomainStore.challengeItems.find(({ id }) => id === answer.challengeItemId)!;
    expectInvalid(
      changed({
        attemptAnswers: mockDomainStore.attemptAnswers.map((candidate) =>
          candidate.id === answer.id ? { ...candidate, points: item.points + 1 } : candidate,
        ),
      }),
      "exceeds its item points",
    );
  });
});
