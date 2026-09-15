import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseRoomQueries } from "./roomQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentViewerProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/server/profile", () => ({
  getCurrentViewerProfile: mocks.getCurrentViewerProfile,
}));

const viewer = {
  id: "00000000-0000-0000-0000-000000000002",
  playerId: "00000000-0000-0000-0000-000000000002",
  name: "Bob Viewer",
  avatarSrc: "/avatars/bob.png",
};

const roomRow = {
  room_id: "00000000-0000-0000-0000-000000000010",
  room_slug: "s06-main",
  room_title: "Sala competitiva S06",
  room_description: "Ranking persistido",
  membership_role: "member",
  season_id: "00000000-0000-0000-0000-000000000011",
  season_title: "Temporada S06",
  season_status: "active",
  season_starts_at: "2000-01-01T00:00:00Z",
  season_ends_at: "2999-01-01T00:00:00Z",
  publication_id: "00000000-0000-0000-0000-000000000012",
  publication_status: "open",
  opens_at: "2000-01-01T00:00:00Z",
  closes_at: "2999-01-01T00:00:00Z",
  challenge_title: "Flash competitivo",
  challenge_subtitle: "Dos preguntas",
  challenge_mode: "flash",
  challenge_max_score: 100,
  question_count: 2,
  competitive_playable: true,
  current_flash_points: 80,
  current_position: 2,
  member_previews: [],
  member_count: 3,
};

const seasonRows = [
  {
    player_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Alice Owner",
    avatar_path: null,
    flash_points: 120,
    is_former_member: false,
    position: 1,
  },
  {
    player_id: viewer.id,
    display_name: "Bob Viewer",
    avatar_path: "/avatars/bob.png",
    flash_points: 80,
    is_former_member: false,
    position: 2,
  },
  {
    player_id: "00000000-0000-0000-0000-000000000003",
    display_name: "Former Carol",
    avatar_path: null,
    flash_points: 20,
    is_former_member: true,
    position: 3,
  },
];

const challengeRows = [
  {
    player_id: viewer.id,
    display_name: "Bob Viewer",
    avatar_path: "/avatars/bob.png",
    flash_points: 80,
    duration_ms: 1400,
    position: 1,
  },
  {
    player_id: "00000000-0000-0000-0000-000000000001",
    display_name: "Alice Owner",
    avatar_path: null,
    flash_points: 50,
    duration_ms: 1600,
    position: 2,
  },
];

describe("SupabaseRoomQueries S06 rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewerProfile.mockResolvedValue(viewer);
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        if (functionName === "get_challenge_ranking") return { data: challengeRows, error: null };
        return { data: [], error: null };
      }),
    });
  });

  it("maps the season ranking and keeps UUIDs as member IDs", async () => {
    const model = await new SupabaseRoomQueries().getRanking("s06-main");

    expect(model).toMatchObject({
      roomId: "s06-main",
      roomTitle: "Sala competitiva S06",
      currentUserId: viewer.id,
    });
    expect(model?.entries).toEqual([
      expect.objectContaining({
        rank: 1,
        memberId: seasonRows[0].player_id,
        name: "Alice Owner",
        initials: "AO",
        flashPoints: 120,
      }),
      expect.objectContaining({
        rank: 2,
        memberId: viewer.id,
        name: "Bob Viewer",
        initials: "BV",
        avatarSrc: "/avatars/bob.png",
        flashPoints: 80,
      }),
      expect.objectContaining({
        rank: 3,
        memberId: seasonRows[2].player_id,
        name: "Former Carol",
        flashPoints: 20,
      }),
    ]);
  });

  it("loads both leaderboards in parallel for a real room detail", async () => {
    const detail = await new SupabaseRoomQueries().getDetail("s06-main");

    expect(detail?.source).toBe("supabase");
    expect(detail?.currentUser).toMatchObject({
      id: viewer.id,
      totalFlashPoints: 80,
      roomRank: 2,
      dailyFlashPoints: 80,
      dailyCompleted: true,
    });
    expect(detail?.roomLeaderboard.map(({ memberId, rank }) => ({ memberId, rank }))).toEqual([
      { memberId: seasonRows[0].player_id, rank: 1 },
      { memberId: viewer.id, rank: 2 },
      { memberId: seasonRows[2].player_id, rank: 3 },
    ]);
    expect(detail?.dailyLeaderboard).toEqual([
      expect.objectContaining({
        memberId: viewer.id,
        rank: 1,
        durationMs: 1400,
        startedAt: "",
        completed: true,
      }),
      expect.objectContaining({ memberId: seasonRows[0].player_id, rank: 2 }),
    ]);
  });

  it("returns null without a season and does not leak ranking data", async () => {
    const client = await mocks.createClient();
    client.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "get_room_detail") {
        return { data: [{ ...roomRow, season_id: null, publication_id: null }], error: null };
      }
      throw new Error(`Unexpected ranking RPC: ${functionName}`);
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(new SupabaseRoomQueries().getRanking("s06-no-season")).resolves.toBeNull();
    await expect(new SupabaseRoomQueries().getDetail("s06-no-season")).resolves.toMatchObject({
      roomLeaderboard: [],
      dailyLeaderboard: [],
    });
  });

  it("propagates an RPC error instead of falling back to mock data", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        return { data: null, error: { message: "permission denied" } };
      }),
    });

    await expect(new SupabaseRoomQueries().getRanking("s06-main")).rejects.toThrow(
      "Supabase ranking read failed (get_season_ranking): permission denied",
    );
  });

  it("rejects malformed ranking rows instead of silently dropping them", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        return { data: [{ ...seasonRows[0], position: "1" }], error: null };
      }),
    });

    await expect(new SupabaseRoomQueries().getRanking("s06-main")).rejects.toThrow(
      "Supabase ranking read returned an invalid row (get_season_ranking, 0)",
    );
  });
});
