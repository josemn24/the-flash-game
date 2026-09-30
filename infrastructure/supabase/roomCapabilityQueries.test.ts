import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseRoomHistoryQueries } from "./roomHistoryQueries";
import { SupabaseRoomLobbyQueries } from "./roomLobbyQueries";
import { SupabaseRoomMemberDetailQueries } from "./roomMemberDetailQueries";

const mocks = vi.hoisted(() => ({
  callHistoryRead: vi.fn(),
  callRankingRead: vi.fn(),
  callRoomRead: vi.fn(),
  createClient: vi.fn(),
  getCurrentViewerProfile: vi.fn(),
  authGetUser: vi.fn(),
  privateAssetResolve: vi.fn(),
}));

vi.mock("./roomReadRpc", () => ({
  callHistoryRead: mocks.callHistoryRead,
  callRankingRead: mocks.callRankingRead,
  callRoomRead: mocks.callRoomRead,
}));

vi.mock("./roomViewMappers", () => ({
  asMemberPreviews: vi.fn(() => []),
  toCalendarEntry: vi.fn(),
  toCard: vi.fn(),
  toChallengeLeaderboard: vi.fn(() => []),
  toDetail: vi.fn(() => ({ source: "supabase" })),
  toIntroduction: vi.fn(),
  toSeasonLeaderboard: vi.fn(() => []),
}));

vi.mock("./roomHistoryMappers", () => ({
  currentMemberChallengeSummary: vi.fn(() => ({ id: "publication-id" })),
  historicalChallengeSummary: vi.fn(() => ({ id: "publication-id" })),
  toHistoricalChallenge: vi.fn(() => null),
  toHistoricalLeaderboard: vi.fn(() => []),
  toHistoricalMember: vi.fn(() => ({})),
  toHistoricalResult: vi.fn(() => null),
  toHistoryEntry: vi.fn(() => ({ id: "publication-id" })),
  toRoomMemberReviewItems: vi.fn(() => []),
  toRoomMemberReviewProgress: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
const viewer = {
  id: "00000000-0000-0000-0000-000000000002",
  playerId: "00000000-0000-0000-0000-000000000002",
  name: "Bob Viewer",
};

const roomRow = {
  room_slug: "room-key",
  room_title: "Sala",
  season_id: "00000000-0000-0000-0000-000000000011",
  membership_role: "member",
  publication_id: "00000000-0000-0000-0000-000000000012",
  publication_status: "open",
};

const historyRow = {
  room_slug: "room-key",
  room_title: "Sala",
  viewer_role: "member",
  season_id: "00000000-0000-0000-0000-000000000011",
  publication_id: "00000000-0000-0000-0000-000000000012",
  challenge_mode: "flash",
};

describe("room capability queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewerProfile.mockResolvedValue(viewer);
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: "auth-user-id" } } });
    mocks.privateAssetResolve.mockImplementation(async ({ publicPayload }) => publicPayload);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.authGetUser },
    });
    mocks.callRankingRead.mockResolvedValue([]);
  });

  it("starts lobby rankings and calendar reads in the existing Promise.all order", async () => {
    const events: string[] = [];
    const releases: Array<() => void> = [];
    mocks.callRoomRead.mockImplementation(async (functionName: string) => {
      events.push(`room:${functionName}`);
      return functionName === "get_room_detail" ? [roomRow] : [];
    });
    mocks.callRankingRead.mockImplementation((functionName: string) => {
      events.push(`ranking:${functionName}`);
      return new Promise<never[]>((resolve) => {
        releases.push(() => resolve([]));
      });
    });

    const pending = new SupabaseRoomLobbyQueries({
      getCurrentViewer: mocks.getCurrentViewerProfile,
    }).getDetail("room-key");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([
      "room:get_room_detail",
      "ranking:get_season_ranking",
      "ranking:get_challenge_ranking",
      "room:get_room_calendar",
    ]);

    releases.forEach((release) => release());
    await expect(pending).resolves.toEqual({ source: "supabase" });
  });

  it("passes the injected expiration dependency through history reads", async () => {
    const expiration = {
      expireStaleAttemptsForRoom: vi.fn(),
    };
    mocks.callHistoryRead.mockImplementation(
      async (
        _functionName: string,
        _args: Record<string, string | null>,
        _guard: (value: unknown) => boolean,
        receivedExpiration: typeof expiration,
      ) => {
        expect(receivedExpiration).toBe(expiration);
        return [];
      },
    );
    mocks.callRoomRead.mockResolvedValue([]);

    await expect(
      new SupabaseRoomHistoryQueries(expiration, {
        getCurrentViewer: mocks.getCurrentViewerProfile,
      }).listHistory("room-key"),
    ).resolves.toBeNull();
  });

  it("does not resolve private assets for another member", async () => {
    const memberKey = "00000000-0000-0000-0000-000000000003";
    mocks.callHistoryRead.mockResolvedValueOnce([historyRow]).mockResolvedValueOnce([
      {
        ...historyRow,
        player_id: memberKey,
        attempt_id: "00000000-0000-0000-0000-000000000016",
        public_payload: { media: { assetId: "private-asset" } },
      },
    ]);

    const model = await new SupabaseRoomMemberDetailQueries(
      { expireStaleAttemptsForRoom: vi.fn() },
      { getCurrentViewer: mocks.getCurrentViewerProfile },
      { resolve: mocks.privateAssetResolve },
    ).getMemberDetail("room-key", memberKey, historyRow.publication_id);

    expect(model).not.toBeNull();
    expect(mocks.privateAssetResolve).not.toHaveBeenCalled();
  });

  it("resolves private assets for the reviewed member", async () => {
    const memberKey = viewer.playerId;
    const reviewRow = {
      ...historyRow,
      player_id: memberKey,
      attempt_id: "00000000-0000-0000-0000-000000000016",
      public_payload: { media: { assetId: "private-asset" } },
    };
    mocks.callHistoryRead.mockResolvedValueOnce([historyRow]).mockResolvedValueOnce([reviewRow]);

    await new SupabaseRoomMemberDetailQueries(
      { expireStaleAttemptsForRoom: vi.fn() },
      { getCurrentViewer: mocks.getCurrentViewerProfile },
      { resolve: mocks.privateAssetResolve },
    ).getMemberDetail("room-key", memberKey, historyRow.publication_id);

    expect(mocks.privateAssetResolve).toHaveBeenCalledWith({
      authUserId: "auth-user-id",
      attemptId: reviewRow.attempt_id,
      publicPayload: reviewRow.public_payload,
    });
  });

  it("returns null for spectator history before loading review data", async () => {
    mocks.callHistoryRead.mockResolvedValueOnce([{ ...historyRow, viewer_role: "spectator" }]);

    await expect(
      new SupabaseRoomMemberDetailQueries(
        { expireStaleAttemptsForRoom: vi.fn() },
        { getCurrentViewer: mocks.getCurrentViewerProfile },
        { resolve: mocks.privateAssetResolve },
      ).getMemberDetail(
        "room-key",
        "00000000-0000-0000-0000-000000000003",
        historyRow.publication_id,
      ),
    ).resolves.toBeNull();

    expect(mocks.callHistoryRead).toHaveBeenCalledTimes(1);
    expect(mocks.callRankingRead).not.toHaveBeenCalled();
  });
});
