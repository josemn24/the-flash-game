import { describe, expect, it, vi } from "vitest";
import { callHistoryRead } from "./roomReadRpc";
import { isRoomMemberReviewReadRow, isRoomHistoryReadRow } from "./roomReadGuards";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/auth/server-client", () => ({
  createClient: mocks.createClient,
}));

describe("room read RPC transport", () => {
  it.each(["passed", "failed", null])(
    "rejects incompatible persisted Survival outcome %s before mapping history",
    async (outcome) => {
      mocks.createClient.mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              challenge_mode: "survival",
              attempt_status: "completed",
              attempt_outcome: outcome,
            },
          ],
          error: null,
        }),
      });
      await expect(
        callHistoryRead(
          "get_room_member_review",
          {
            target_room_slug: "room",
            target_publication_id: "publication",
            target_player_id: "player",
          },
          isRoomMemberReviewReadRow,
          { expireStaleAttemptsForRoom: vi.fn() },
        ),
      ).rejects.toMatchObject({ code: "invalid_attempt_lifecycle" });
    },
  );
  it("expires stale attempts before invoking the history RPC", async () => {
    const events: string[] = [];
    const expiration = {
      expireStaleAttemptsForRoom: vi.fn(async (roomKey: string) => {
        events.push(`expire:${roomKey}`);
        return {
          runId: "test-run",
          evaluatedAt: "2026-09-30T00:00:00.000Z",
          abandonedAttempts: 0,
        };
      }),
    };
    const rpc = vi.fn(async () => {
      events.push("rpc");
      return { data: [], error: null };
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await callHistoryRead(
      "get_room_history",
      { target_room_slug: "room-key" },
      isRoomHistoryReadRow,
      expiration,
    );

    expect(events).toEqual(["expire:room-key", "rpc"]);
    expect(rpc).toHaveBeenCalledWith("get_room_history", {
      target_room_slug: "room-key",
    });
  });
});
