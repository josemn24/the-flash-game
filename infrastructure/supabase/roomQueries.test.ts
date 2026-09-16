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

const historyRows = [
  {
    room_id: roomRow.room_id,
    room_slug: roomRow.room_slug,
    room_title: roomRow.room_title,
    viewer_role: "member",
    season_id: roomRow.season_id,
    season_title: "Temporada S06",
    publication_id: "00000000-0000-0000-0000-000000000012",
    publication_number: 1,
    publication_status: "closed",
    publication_opens_at: "2026-01-01T00:00:00Z",
    publication_closes_at: "2026-01-02T00:00:00Z",
    challenge_id: "00000000-0000-0000-0000-000000000013",
    challenge_slug: "s07-flash-history",
    challenge_version_id: "00000000-0000-0000-0000-000000000014",
    challenge_title: "Flash histórico",
    challenge_subtitle: "Dos preguntas",
    challenge_description: "Revisión",
    challenge_mode: "flash",
    challenge_max_score: 100,
    question_count: 2,
    played_at: "2026-01-02T00:00:00Z",
    player_count: 1,
    player_id: viewer.id,
    display_name: viewer.name,
    avatar_path: viewer.avatarSrc,
    flash_points: 80,
    duration_ms: 1400,
    started_at: "2026-01-01T10:00:00Z",
    position: 1,
  },
  {
    room_id: roomRow.room_id,
    room_slug: roomRow.room_slug,
    room_title: roomRow.room_title,
    viewer_role: "member",
    season_id: roomRow.season_id,
    season_title: "Temporada S06",
    publication_id: "00000000-0000-0000-0000-000000000015",
    publication_number: 2,
    publication_status: "closed",
    publication_opens_at: "2026-01-03T00:00:00Z",
    publication_closes_at: "2026-01-04T00:00:00Z",
    challenge_id: "00000000-0000-0000-0000-000000000013",
    challenge_slug: "s07-flash-history",
    challenge_version_id: "00000000-0000-0000-0000-000000000014",
    challenge_title: "Flash histórico",
    challenge_subtitle: "Dos preguntas",
    challenge_description: "Revisión",
    challenge_mode: "flash",
    challenge_max_score: 100,
    question_count: 2,
    played_at: "2026-01-04T00:00:00Z",
    player_count: 0,
    player_id: null,
    display_name: null,
    avatar_path: null,
    flash_points: null,
    duration_ms: null,
    started_at: null,
    position: null,
  },
];

const reviewRows = [
  {
    room_id: roomRow.room_id,
    room_slug: roomRow.room_slug,
    room_title: roomRow.room_title,
    viewer_role: "member",
    publication_id: historyRows[0].publication_id,
    publication_status: "closed",
    publication_closes_at: historyRows[0].publication_closes_at,
    challenge_id: historyRows[0].challenge_id,
    challenge_slug: historyRows[0].challenge_slug,
    challenge_version_id: historyRows[0].challenge_version_id,
    challenge_title: historyRows[0].challenge_title,
    challenge_subtitle: historyRows[0].challenge_subtitle,
    challenge_description: historyRows[0].challenge_description,
    challenge_mode: "flash",
    challenge_max_score: 100,
    player_id: viewer.id,
    display_name: viewer.name,
    avatar_path: viewer.avatarSrc,
    attempt_id: "00000000-0000-0000-0000-000000000016",
    attempt_status: "completed",
    attempt_score: 80,
    attempt_started_at: "2026-01-01T10:00:00Z",
    attempt_completed_at: "2026-01-01T10:01:00Z",
    attempt_lock_version: 4,
    challenge_item_id: "00000000-0000-0000-0000-000000000017",
    item_position: 1,
    question_version_id: "00000000-0000-0000-0000-000000000018",
    question_type: "multiple-choice",
    payload_schema_version: 1,
    public_payload: {
      category: "Cultura",
      tags: { domains: ["culture"], topics: ["general"], cognitiveSkills: ["memory"], formatSkills: ["recall"], lifeSkills: [] },
      prompt: "¿Capital?",
      context: null,
      timeLimitMs: 15000,
      payload: { options: ["Lisboa", "Oporto"], media: null, promptVisual: null },
    },
    solution_payload: {
      solution: { explanation: "Explicación persistida", payload: { correctAnswer: "Lisboa" } },
      reveals: [],
    },
    answer: "Lisboa",
    answer_status: "correct",
    points: 50,
    result_details: null,
    presented_at: "2026-01-01T10:00:00Z",
    submitted_at: "2026-01-01T10:00:01Z",
    time_used_ms: 900,
    item_points: 50,
  },
  {
    ...historyRows[0],
    viewer_role: "member",
    publication_status: "closed",
    publication_closes_at: historyRows[0].publication_closes_at,
    challenge_id: historyRows[0].challenge_id,
    challenge_slug: historyRows[0].challenge_slug,
    challenge_version_id: historyRows[0].challenge_version_id,
    player_id: viewer.id,
    display_name: viewer.name,
    avatar_path: viewer.avatarSrc,
    attempt_id: "00000000-0000-0000-0000-000000000016",
    attempt_status: "completed",
    attempt_score: 80,
    attempt_started_at: "2026-01-01T10:00:00Z",
    attempt_completed_at: "2026-01-01T10:01:00Z",
    attempt_lock_version: 4,
    challenge_item_id: "00000000-0000-0000-0000-000000000019",
    item_position: 2,
    question_version_id: "00000000-0000-0000-0000-000000000020",
    question_type: "multiple-choice",
    payload_schema_version: 1,
    public_payload: {
      category: "Cultura",
      tags: { domains: ["culture"], topics: ["general"], cognitiveSkills: ["memory"], formatSkills: ["recall"], lifeSkills: [] },
      prompt: "¿Planeta?",
      context: null,
      timeLimitMs: 15000,
      payload: { options: ["Venus", "Marte"], media: null, promptVisual: null },
    },
    solution_payload: {
      solution: { explanation: "Segunda explicación", payload: { correctAnswer: "Marte" } },
      reveals: [],
    },
    answer: null,
    answer_status: null,
    points: null,
    result_details: null,
    presented_at: null,
    submitted_at: null,
    time_used_ms: null,
    item_points: 50,
  },
];

describe("SupabaseRoomQueries S07 history and review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewerProfile.mockResolvedValue(viewer);
  });

  it("groups historical rows and keeps empty publications", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) =>
        functionName === "get_flash_history" ? { data: historyRows, error: null } : { data: [], error: null },
      ),
    });
    const model = await new SupabaseRoomQueries().listHistory("s06-main");
    expect(model?.entries).toHaveLength(2);
    expect(model?.rankings[historyRows[0].publication_id]).toEqual([
      expect.objectContaining({ memberId: viewer.id, startedAt: historyRows[0].started_at }),
    ]);
    expect(model?.rankings[historyRows[1].publication_id]).toEqual([]);
    expect(model?.source).toBe("supabase");
  });

  it("reconstructs a persisted completed review without local session data", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_flash_history") return { data: historyRows, error: null };
        if (functionName === "get_flash_member_review") return { data: reviewRows, error: null };
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        return { data: challengeRows, error: null };
      }),
    });
    const model = await new SupabaseRoomQueries().getMemberDetail(
      "s06-main",
      viewer.id,
      historyRows[0].publication_id,
    );
    expect(model).toMatchObject({
      source: "supabase",
      challengeSummary: { id: historyRows[0].publication_id },
      challengeRank: 1,
      result: { completed: true, flashPoints: 80 },
    });
    expect(model?.challenge?.mode).toBe("flash");
    expect(model?.challenge?.questions).toHaveLength(2);
    expect(model?.result?.attempt?.answers[1]?.status).toBe("unanswered");
    expect(model?.returnHref).toBe(`/salas/s06-main/historial/${historyRows[0].publication_id}`);
  });

  it("propagates malformed history rows and RPC errors", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: [{ ...historyRows[0], player_count: "1" }], error: null })),
    });
    await expect(new SupabaseRoomQueries().listHistory("s06-main")).rejects.toThrow(
      "Supabase history read returned an invalid row",
    );
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: null, error: { message: "permission denied" } })),
    });
    await expect(new SupabaseRoomQueries().listHistory("s06-main")).rejects.toThrow(
      "Supabase history read failed (get_flash_history): permission denied",
    );
  });
});
