import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import { supabaseAttemptExpiration } from "@/infrastructure/supabase/attempts/attemptExpiration";
import { supabasePrivateQuestionAssetResolver } from "@/infrastructure/supabase/assets/privateQuestionAssetResolver";
import type { QueryContext } from "@/types/view-models";
import { defineRoomReadPublicContract } from "@/test-utils/roomReadContract";
import { SupabaseRoomHistoryQueries } from "./roomHistoryQueries";
import { SupabaseRoomLobbyQueries } from "./roomLobbyQueries";
import { SupabaseRoomMemberDetailQueries } from "./roomMemberDetailQueries";
import { SupabaseRoomRankingQueries } from "./roomRankingQueries";
import { SupabaseRoomSettingsQueries } from "./roomSettingsQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentViewerProfile: vi.fn(),
  expireStaleAttemptsForRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/infrastructure/supabase/identity/currentViewer", () => ({
  supabaseCurrentViewerReader: {
    getCurrentViewer: mocks.getCurrentViewerProfile,
  },
  getProvisionedCurrentPlayer: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/attempts/attemptExpiration", () => ({
  supabaseAttemptExpiration: {
    expireStaleAttemptsForRoom: mocks.expireStaleAttemptsForRoom,
  },
}));

const viewer = {
  id: "00000000-0000-0000-0000-000000000002",
  playerId: "00000000-0000-0000-0000-000000000002",
  name: "Bob Viewer",
  avatarSrc: "/avatars/bob.png",
};

const queryContext = {
  viewer,
  now: "2026-09-30T10:00:00.000Z",
} as QueryContext;

type RoomReadCapabilities = RoomHistoryQueries &
  RoomLobbyQueries &
  RoomMemberDetailQueries &
  RoomRankingQueries &
  RoomSettingsQueries;

function createRoomReadCapabilities(): RoomReadCapabilities {
  const lobby = new SupabaseRoomLobbyQueries();
  const ranking = new SupabaseRoomRankingQueries();
  const settings = new SupabaseRoomSettingsQueries();
  const history = new SupabaseRoomHistoryQueries(supabaseAttemptExpiration);
  const memberDetail = new SupabaseRoomMemberDetailQueries(
    supabaseAttemptExpiration,
    supabasePrivateQuestionAssetResolver,
  );

  return {
    listCards: (context) => lobby.listCards(context),
    getDetail: (roomKey, context) => lobby.getDetail(roomKey, context),
    getIntroduction: (roomKey, challengeKey, context) =>
      lobby.getIntroduction(roomKey, challengeKey, context),
    getRanking: (roomKey, context) => ranking.getRanking(roomKey, context),
    getSettings: (roomKey, context) => settings.getSettings(roomKey, context),
    listHistory: (roomKey, context) => history.listHistory(roomKey, context),
    getHistoryDetail: (roomKey, publicationKey, context) =>
      history.getHistoryDetail(roomKey, publicationKey, context),
    getMemberDetail: (roomKey, memberKey, context, publicationKey) =>
      memberDetail.getMemberDetail(roomKey, memberKey, context, publicationKey),
  };
}

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
  member_previews: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Alice Owner",
      avatarPath: null,
      role: "owner",
    },
    {
      id: viewer.id,
      name: "Bob Viewer",
      avatarPath: "/avatars/bob.png",
      role: "member",
    },
    {
      id: "00000000-0000-0000-0000-000000000004",
      name: "Dora Spectator",
      avatarPath: null,
      role: "spectator",
    },
  ],
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

const calendarRow = {
  room_id: roomRow.room_id,
  room_slug: roomRow.room_slug,
  room_title: roomRow.room_title,
  time_zone: "Europe/Madrid",
  membership_role: "member",
  season_id: roomRow.season_id,
  season_title: roomRow.season_title,
  season_status: "active",
  publication_id: roomRow.publication_id,
  publication_number: 1,
  publication_status: "open",
  availability_status: "available",
  opens_at: roomRow.opens_at,
  closes_at: roomRow.closes_at,
  challenge_title: roomRow.challenge_title,
  challenge_subtitle: roomRow.challenge_subtitle,
  challenge_mode: "flash",
  question_count: roomRow.question_count,
  own_attempt_status: null,
  can_start: true,
  can_continue: false,
};

describe("Supabase room read capabilities S06 rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewerProfile.mockResolvedValue(viewer);
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        if (functionName === "get_challenge_ranking") return { data: challengeRows, error: null };
        if (functionName === "get_room_calendar") return { data: [], error: null };
        return { data: [], error: null };
      }),
    });
  });

  defineRoomReadPublicContract("Supabase room read public contract", async () => {
    const capabilities = createRoomReadCapabilities();
    return Promise.all([
      capabilities.listCards(queryContext),
      capabilities.getDetail("s06-main", queryContext),
      capabilities.getSettings("s06-main", queryContext),
      capabilities.getRanking("s06-main", queryContext),
      capabilities.getMemberDetail("s06-main", viewer.id, queryContext),
      capabilities.listHistory("s06-main", queryContext),
    ]);
  });

  it("maps the season ranking and keeps UUIDs as member IDs", async () => {
    const model = await createRoomReadCapabilities().getRanking("s06-main", queryContext);

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
    const detail = await createRoomReadCapabilities().getDetail("s06-main", queryContext);

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

  it.each([
    ["completed", "completed"],
    ["in_progress", "inProgress"],
    ["abandoned", "notCompleted"],
    ["invalidated", "notCompleted"],
  ] as const)(
    "uses the effective publication window and maps %s attempts",
    async (ownAttemptStatus, expectedStatus) => {
      mocks.createClient.mockResolvedValue({
        rpc: vi.fn(async (functionName: string) => {
          if (functionName === "get_room_detail") {
            return { data: [{ ...roomRow, publication_status: "scheduled" }], error: null };
          }
          if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
          if (functionName === "get_challenge_ranking") {
            return { data: challengeRows, error: null };
          }
          if (functionName === "get_room_calendar") {
            return {
              data: [
                {
                  ...calendarRow,
                  publication_status: "scheduled",
                  availability_status: "available",
                  own_attempt_status: ownAttemptStatus,
                },
              ],
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      });

      const detail = await createRoomReadCapabilities().getDetail("s06-main", queryContext);

      expect(detail?.currentUser).toMatchObject({
        dailyAttemptStatus: expectedStatus,
        dailyFlashPoints: 80,
        dailyCompleted: true,
      });
      expect(detail?.dailyLeaderboard).toEqual(
        expect.arrayContaining([expect.objectContaining({ memberId: viewer.id, flashPoints: 80 })]),
      );
    },
  );

  it("maps room settings from member previews and season points", async () => {
    const model = await createRoomReadCapabilities().getSettings("s06-main", queryContext);

    expect(model).toMatchObject({
      roomId: "s06-main",
      title: "Sala competitiva S06",
      currentUserId: viewer.id,
      viewerRole: "member",
      canManageMembers: false,
      memberCount: 3,
    });
    expect(model?.members).toEqual([
      expect.objectContaining({
        id: seasonRows[0].player_id,
        name: "Alice Owner",
        totalFlashPoints: 120,
        role: "owner",
        canManage: false,
        isCurrentUser: false,
      }),
      expect.objectContaining({
        id: viewer.id,
        name: "Bob Viewer",
        totalFlashPoints: 80,
        role: "member",
        canManage: false,
        isCurrentUser: true,
      }),
      expect.objectContaining({
        name: "Dora Spectator",
        totalFlashPoints: 0,
        role: "spectator",
        canManage: false,
        isCurrentUser: false,
      }),
    ]);
  });

  it("marks the owner as the only viewer who can manage members", async () => {
    const ownerContext = {
      viewer: {
        id: "00000000-0000-0000-0000-000000000001",
        playerId: "00000000-0000-0000-0000-000000000001",
        name: "Alice Owner",
        avatarSrc: undefined,
      },
      now: queryContext.now,
    } as QueryContext;
    mocks.getCurrentViewerProfile.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      playerId: "00000000-0000-0000-0000-000000000001",
      name: "Alice Owner",
      avatarSrc: undefined,
    });
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") {
          return { data: [{ ...roomRow, membership_role: "owner" }], error: null };
        }
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        return { data: [], error: null };
      }),
    });

    await expect(
      createRoomReadCapabilities().getSettings("s06-main", ownerContext),
    ).resolves.toMatchObject({
      viewerRole: "owner",
      canManageMembers: true,
      members: [
        expect.objectContaining({ name: "Alice Owner", role: "owner", canManage: false }),
        expect.objectContaining({ name: "Bob Viewer", role: "member", canManage: true }),
        expect.objectContaining({ name: "Dora Spectator", role: "spectator", canManage: true }),
      ],
    });
  });

  it("keeps accessible members when a room has no active season", async () => {
    const client = await mocks.createClient();
    client.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "get_room_detail") {
        return { data: [{ ...roomRow, season_id: null }], error: null };
      }
      throw new Error(`Unexpected settings RPC: ${functionName}`);
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      createRoomReadCapabilities().getSettings("s06-no-season", queryContext),
    ).resolves.toMatchObject({
      memberCount: 3,
      members: [
        expect.objectContaining({ name: "Alice Owner", totalFlashPoints: 0 }),
        expect.objectContaining({ name: "Bob Viewer", totalFlashPoints: 0 }),
        expect.objectContaining({ name: "Dora Spectator", totalFlashPoints: 0 }),
      ],
    });
  });

  it("returns null for an inaccessible room", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: [], error: null })),
    });
    await expect(
      createRoomReadCapabilities().getSettings("s06-missing", queryContext),
    ).resolves.toBeNull();
  });

  it("propagates settings RPC errors instead of falling back to mock data", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: null, error: { message: "permission denied" } })),
    });

    await expect(
      createRoomReadCapabilities().getSettings("s06-main", queryContext),
    ).rejects.toThrow("Supabase room read failed (get_room_detail): permission denied");
  });

  it("returns null without a season and does not leak ranking data", async () => {
    const client = await mocks.createClient();
    client.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "get_room_detail") {
        return { data: [{ ...roomRow, season_id: null, publication_id: null }], error: null };
      }
      if (functionName === "get_room_calendar") return { data: [], error: null };
      throw new Error(`Unexpected ranking RPC: ${functionName}`);
    });
    mocks.createClient.mockResolvedValue(client);

    await expect(
      createRoomReadCapabilities().getRanking("s06-no-season", queryContext),
    ).resolves.toBeNull();
    await expect(
      createRoomReadCapabilities().getDetail("s06-no-season", queryContext),
    ).resolves.toMatchObject({
      roomLeaderboard: [],
      dailyLeaderboard: [],
    });
    expect(
      client.rpc.mock.calls.some(
        ([functionName]: [string]) => functionName === "get_challenge_ranking",
      ),
    ).toBe(false);
  });

  it("propagates an RPC error instead of falling back to mock data", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        return { data: null, error: { message: "permission denied" } };
      }),
    });

    await expect(createRoomReadCapabilities().getRanking("s06-main", queryContext)).rejects.toThrow(
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

    await expect(createRoomReadCapabilities().getRanking("s06-main", queryContext)).rejects.toThrow(
      "Supabase ranking read returned an invalid row (get_season_ranking, 0)",
    );
  });

  it("rejects malformed calendar rows instead of silently dropping them", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        if (functionName === "get_room_calendar") return { data: [{ time_zone: 42 }], error: null };
        return { data: [], error: null };
      }),
    });

    await expect(createRoomReadCapabilities().getDetail("s06-main", queryContext)).rejects.toThrow(
      "Supabase room read returned an invalid row (get_room_calendar, 0)",
    );
  });
});

describe("Supabase room lobby capability resilience", () => {
  it("keeps a room without an active season when member previews are null", async () => {
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "get_my_room_cards") {
        return {
          data: [
            {
              ...roomRow,
              room_slug: "s02-no-season",
              room_title: "Sala sin temporada",
              season_id: null,
              season_title: null,
              season_status: null,
              season_starts_at: null,
              season_ends_at: null,
              publication_id: null,
              publication_status: null,
              opens_at: null,
              closes_at: null,
              challenge_title: null,
              challenge_subtitle: null,
              challenge_mode: null,
              challenge_max_score: null,
              question_count: null,
              competitive_playable: null,
              member_previews: null,
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    mocks.createClient.mockResolvedValue({ rpc });

    await expect(createRoomReadCapabilities().listCards(queryContext)).resolves.toMatchObject([
      { roomId: "s02-no-season", title: "Sala sin temporada", dailyChallenge: null },
    ]);
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
    initial_lives: null,
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
    challenge_slug: "s07-survival-history",
    challenge_version_id: "00000000-0000-0000-0000-000000000024",
    challenge_title: "Supervivencia histórica",
    challenge_subtitle: "Dos preguntas y vidas",
    challenge_description: "Ranking histórico",
    challenge_mode: "survival",
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
    season_id: roomRow.season_id,
    season_title: "Temporada S06",
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
    question_count: 2,
    initial_lives: null,
    player_id: viewer.id,
    display_name: viewer.name,
    avatar_path: viewer.avatarSrc,
    attempt_id: "00000000-0000-0000-0000-000000000016",
    attempt_status: "completed",
    attempt_score: 80,
    attempt_outcome: null,
    attempt_started_at: "2026-01-01T10:00:00Z",
    attempt_completed_at: "2026-01-01T10:01:00Z",
    attempt_duration_ms: 60000,
    attempt_lock_version: 4,
    challenge_item_id: "00000000-0000-0000-0000-000000000017",
    item_position: 1,
    question_version_id: "00000000-0000-0000-0000-000000000018",
    question_type: "multiple-choice",
    payload_schema_version: 1,
    public_payload: {
      category: "Cultura",
      tags: {
        domains: ["culture"],
        topics: ["general"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
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
    has_persisted_answer: true,
    level_id: null,
    level_label: null,
    briefing_title: null,
    briefing_format: null,
    briefing_description: null,
    global_time_limit_ms: null,
    alphabet_letter: null,
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
    attempt_outcome: null,
    attempt_started_at: "2026-01-01T10:00:00Z",
    attempt_completed_at: "2026-01-01T10:01:00Z",
    attempt_duration_ms: 60000,
    attempt_lock_version: 4,
    challenge_item_id: "00000000-0000-0000-0000-000000000019",
    item_position: 2,
    question_version_id: "00000000-0000-0000-0000-000000000020",
    question_type: "multiple-choice",
    payload_schema_version: 1,
    public_payload: {
      category: "Cultura",
      tags: {
        domains: ["culture"],
        topics: ["general"],
        cognitiveSkills: ["memory"],
        formatSkills: ["recall"],
        lifeSkills: [],
      },
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
    has_persisted_answer: false,
    level_id: null,
    level_label: null,
    briefing_title: null,
    briefing_format: null,
    briefing_description: null,
    global_time_limit_ms: null,
    alphabet_letter: null,
  },
];

describe("Supabase history and review capabilities S07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewerProfile.mockResolvedValue(viewer);
    mocks.expireStaleAttemptsForRoom.mockResolvedValue({
      runId: "history-test",
      evaluatedAt: "2026-09-28T10:00:00.000Z",
      abandonedAttempts: 0,
    });
  });

  it("groups historical rows and keeps empty publications", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) =>
        functionName === "get_room_history"
          ? { data: historyRows, error: null }
          : { data: [], error: null },
      ),
    });
    const model = await createRoomReadCapabilities().listHistory("s06-main", queryContext);
    expect(model?.entries).toHaveLength(2);
    expect(model?.rankings[historyRows[0].publication_id]).toEqual([
      expect.objectContaining({ memberId: viewer.id, startedAt: historyRows[0].started_at }),
    ]);
    expect(model?.rankings[historyRows[1].publication_id]).toEqual([]);
    expect(model?.entries[1]).toMatchObject({
      mode: "survival",
      formatLabel: "Supervivencia",
      subtitle: "Dos preguntas y vidas",
      questionCount: 2,
      maxScore: 100,
    });
    expect(model?.source).toBe("supabase");
  });

  it("reconstructs a persisted completed review without local session data", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_history") return { data: historyRows, error: null };
        if (functionName === "get_room_member_review") return { data: reviewRows, error: null };
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        return { data: challengeRows, error: null };
      }),
    });
    const model = await createRoomReadCapabilities().getMemberDetail(
      "s06-main",
      viewer.id,
      queryContext,
      historyRows[0].publication_id,
    );
    expect(model).toMatchObject({
      source: "supabase",
      challengeSummary: { id: historyRows[0].publication_id },
      challengeRank: 1,
      result: { completed: true, flashPoints: 80 },
    });
    expect(model?.challenge?.mode).toBe("flash");
    expect(
      model?.challenge && "questions" in model.challenge ? model.challenge.questions : null,
    ).toHaveLength(2);
    expect(model?.result?.attempt?.answers[1]?.status).toBe("unanswered");
    expect(model?.returnHref).toBe(`/salas/s06-main/historial/${historyRows[0].publication_id}`);
  });

  it("keeps historical ranking visible and enables non-Flash review", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) =>
        functionName === "get_room_history"
          ? { data: [historyRows[1]], error: null }
          : { data: [], error: null },
      ),
    });
    const model = await createRoomReadCapabilities().getHistoryDetail(
      "s06-main",
      historyRows[1].publication_id,
      queryContext,
    );
    expect(model?.ranking).toEqual([]);
    expect(model?.canReviewMembers).toBe(true);
    await expect(
      createRoomReadCapabilities().getMemberDetail(
        "s06-main",
        viewer.id,
        queryContext,
        historyRows[1].publication_id,
      ),
    ).resolves.toBeNull();
  });

  it.each(["completed", "abandoned"])(
    "reconstructs all Alphabet letters for a %s attempt",
    async (status) => {
      const alphabetHistory = { ...historyRows[0], challenge_mode: "alphabet" };
      const alphabetRows = Array.from({ length: 4 }, (_, index) => ({
        ...reviewRows[index === 0 ? 0 : 1],
        challenge_mode: "alphabet",
        question_count: 4,
        attempt_status: status,
        attempt_score: status === "completed" ? 25 : null,
        question_type: "short-text",
        challenge_item_id: `alphabet-item-${index}`,
        item_position: index + 1,
        time_limit_ms: 30000,
        global_time_limit_ms: 90000,
        alphabet_letter: ["B", "A", "Ñ", "Z"][index],
        item_points: 25,
        public_payload: { question: `Pregunta ${index}` },
        solution_payload: {
          correctAnswer: "Lovelace",
          acceptedAnswers: ["Lovelace"],
          explanation: "Solución de Alfabeto",
        },
        answer: index === 0 ? "Lovelace" : index === 1 ? "Otro" : null,
        answer_status: ["correct", "incorrect", "timeout", null][index],
        points: index === 0 ? 25 : index < 3 ? 0 : null,
        has_persisted_answer: index < 3,
      }));
      mocks.createClient.mockResolvedValue({
        rpc: vi.fn(async (name: string) => ({
          data:
            name === "get_room_member_review"
              ? alphabetRows
              : name === "get_room_history"
                ? [alphabetHistory]
                : seasonRows,
          error: null,
        })),
      });
      const model = await createRoomReadCapabilities().getMemberDetail(
        "s06-main",
        viewer.id,
        queryContext,
        alphabetHistory.publication_id,
      );
      expect(model?.challenge).toMatchObject({
        mode: "alphabet",
        timeLimit: 90,
        entries: [{ letter: "B" }, { letter: "A" }, { letter: "Ñ" }, { letter: "Z" }],
      });
      expect(model?.reviewProgress).toEqual({
        mode: "alphabet",
        answeredCount: 3,
        correctCount: 1,
        totalLetterCount: 4,
      });
      expect(model?.reviewItems.map((item) => item.metadata?.alphabetLetter)).toEqual([
        "B",
        "A",
        "Ñ",
        "Z",
      ]);
      expect(model?.reviewItems.map((item) => item.result?.status)).toEqual([
        "correct",
        "incorrect",
        "unanswered",
        "unanswered",
      ]);
      expect(model?.result?.completed).toBe(status === "completed");
    },
  );

  it.each([
    { global_time_limit_ms: 0 },
    { alphabet_letter: "AB" },
    { question_type: "multiple-choice" },
    { public_payload: { question: 123 } },
    { solution_payload: { acceptedAnswers: [] } },
  ])("rejects invalid Alphabet configuration or payloads: %j", async (invalid) => {
    const row = {
      ...reviewRows[0],
      challenge_mode: "alphabet",
      question_count: 1,
      question_type: "short-text",
      time_limit_ms: 30000,
      global_time_limit_ms: 90000,
      alphabet_letter: "Ñ",
      public_payload: { question: "Pregunta" },
      solution_payload: { correctAnswer: "Respuesta", acceptedAnswers: ["Respuesta"] },
      ...invalid,
    };
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (name: string) => ({
        data:
          name === "get_room_member_review"
            ? [row]
            : name === "get_room_history"
              ? [{ ...historyRows[0], challenge_mode: "alphabet" }]
              : seasonRows,
        error: null,
      })),
    });
    await expect(
      createRoomReadCapabilities().getMemberDetail(
        "s06-main",
        viewer.id,
        queryContext,
        historyRows[0].publication_id,
      ),
    ).rejects.toThrow();
  });

  it("propagates malformed history rows and RPC errors", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: [{ ...historyRows[0], player_count: "1" }], error: null })),
    });
    await expect(
      createRoomReadCapabilities().listHistory("s06-main", queryContext),
    ).rejects.toThrow("Supabase history read returned an invalid row");
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async () => ({ data: null, error: { message: "permission denied" } })),
    });
    await expect(
      createRoomReadCapabilities().listHistory("s06-main", queryContext),
    ).rejects.toThrow("Supabase history read failed (get_room_history): permission denied");
  });

  it("uses the viewer carried by the query context", async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "get_room_detail") return { data: [roomRow], error: null };
        if (functionName === "get_season_ranking") return { data: seasonRows, error: null };
        return { data: [], error: null };
      }),
    });
    const model = await createRoomReadCapabilities().getRanking("s06-main", queryContext);

    expect(model?.currentUserId).toBe(viewer.playerId);
  });
});
