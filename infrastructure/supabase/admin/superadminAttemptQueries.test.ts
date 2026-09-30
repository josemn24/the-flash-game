import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SupabaseSuperadminAttemptQueries } from "./superadminAttemptQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const id = (suffix: string) => `00000000-0000-4000-8000-00000000000${suffix}`;
const timestamp = "2026-09-25T10:00:00.000Z";

const publication = {
  scheduledChallengeId: id("1"),
  roomId: id("2"),
  roomTitle: "Sala beta",
  seasonId: id("3"),
  seasonTitle: "Temporada beta",
  seasonStatus: "active",
  challengeVersionId: id("4"),
  challengeSlug: "flash-beta",
  versionNumber: 1,
  challengeTitle: "Flash beta",
  challengeSubtitle: "Dos preguntas",
  mode: "flash",
  number: 1,
  status: "closed",
  opensAt: timestamp,
  closesAt: "2026-09-25T11:00:00.000Z",
  updatedAt: timestamp,
};

const attempt = {
  attemptId: id("5"),
  playerId: id("6"),
  displayName: "Jugador",
  avatarPath: "legacy/avatar.png",
  status: "completed",
  outcome: null,
  attemptNumber: 1,
  startedAt: timestamp,
  deadlineAt: null,
  completedAt: "2026-09-25T10:05:00.000Z",
  originalScore: 70,
  effectiveScore: 80,
  lockVersion: 4,
  isCorrected: true,
};

describe("SupabaseSuperadminAttemptQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("validates the publication list and maps a cursor-paginated attempt list", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { entries: [publication] }, error: null })
      .mockResolvedValueOnce({
        data: {
          publication,
          attempts: [attempt],
          nextCursor: { startedAt: timestamp, attemptId: attempt.attemptId },
        },
        error: null,
      });

    const queries = new SupabaseSuperadminAttemptQueries();
    await expect(queries.listPublications(publication.roomId)).resolves.toEqual([publication]);
    await expect(
      queries.listAttempts(publication.roomId, publication.scheduledChallengeId, {
        startedAt: timestamp,
        attemptId: id("7"),
      }),
    ).resolves.toMatchObject({
      roomId: publication.roomId,
      attempts: [{ ...attempt, avatarSrc: "legacy/avatar.png" }],
      nextCursor: { attemptId: attempt.attemptId },
    });

    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "get_superadmin_room_attempts", {
      target_room_id: publication.roomId,
      target_scheduled_challenge_id: publication.scheduledChallengeId,
      cursor_started_at: timestamp,
      cursor_attempt_id: id("7"),
      page_size: 50,
    });
  });

  it("validates the complete inspection projection without inventing private fields", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        publication,
        attempt: { ...attempt, email: "jugador@example.test", terminalReason: null },
        items: [
          {
            challengeItemId: id("8"),
            position: 1,
            itemPoints: 100,
            questionVersionId: id("9"),
            questionType: "multiple-choice",
            publicPayload: { prompt: "Pregunta" },
            answer: "a",
            status: "correct",
            resultDetails: { evaluated: true },
            awardedPoints: 70,
            presentedAt: timestamp,
            submittedAt: "2026-09-25T10:01:00.000Z",
            timeUsedMs: 1000,
          },
        ],
        ledger: [
          {
            entryId: id("a"),
            entryType: "accreditation",
            amount: 70,
            reason: null,
            createdByPlayerId: null,
            createdByDisplayName: null,
            createdAt: timestamp,
          },
        ],
        audit: [
          {
            auditId: id("b"),
            action: "adjust",
            entityType: "attempt",
            entityId: attempt.attemptId,
            reason: "Revisión",
            requestId: "request-1",
            actorPlayerId: id("c"),
            actorDisplayName: "Superadmin",
            beforePayload: { score: 70 },
            afterPayload: { score: 80 },
            createdAt: timestamp,
          },
        ],
      },
      error: null,
    });

    await expect(
      new SupabaseSuperadminAttemptQueries().getInspection(
        publication.roomId,
        publication.scheduledChallengeId,
        attempt.attemptId,
      ),
    ).resolves.toMatchObject({
      attempt: { email: "jugador@example.test", effectiveScore: 80 },
      items: [{ answer: "a", awardedPoints: 70 }],
      audit: [{ action: "adjust" }],
    });
  });

  it("maps authorization failures and rejects malformed RPC payloads", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
    await expect(
      new SupabaseSuperadminAttemptQueries().listPublications(publication.roomId),
    ).rejects.toBeInstanceOf(SuperadminAccessDeniedError);

    mocks.rpc.mockResolvedValueOnce({
      data: { entries: [{ ...publication, mode: "narrative" }] },
      error: null,
    });
    await expect(
      new SupabaseSuperadminAttemptQueries().listPublications(publication.roomId),
    ).rejects.toThrow("invalid payload");
  });
});
