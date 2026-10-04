import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryContext } from "@/types/view-models";
import { SupabaseRoomRankingQueries } from "./roomRankingQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  readRoom: vi.fn(),
  readRanking: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./roomReadRpc", () => ({
  callRoomRead: mocks.readRoom,
  callRankingRead: mocks.readRanking,
}));

const context = {
  viewer: { playerId: "viewer", id: "viewer", name: "Diego" },
  now: "2026-10-04T10:00:00Z",
} as QueryContext;

const room = {
  room_id: "room-id",
  room_slug: "tabarnia",
  room_title: "Tabarnia",
  season_id: null,
  season_title: null,
  season_status: null,
  season_ends_at: null,
};

function seasonQuery(
  data: { id: string; title: string } | null,
  error: { message: string } | null = null,
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });
  return query;
}

describe("season ranking selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readRoom.mockResolvedValue([room]);
    mocks.readRanking.mockResolvedValue([
      {
        player_id: "viewer",
        display_name: "Diego",
        avatar_path: null,
        flash_points: 55,
        position: 1,
      },
    ]);
  });

  it("prefers the active season over previously finished seasons", async () => {
    seasonQuery({ id: "finished-season", title: "Anterior" });
    mocks.readRoom.mockResolvedValue([
      {
        ...room,
        season_id: "active-season",
        season_title: "Actual",
        season_status: "active",
        season_ends_at: "2026-11-01T00:00:00Z",
      },
    ]);
    const model = await new SupabaseRoomRankingQueries().getRanking("tabarnia", context);
    expect(model?.season).toEqual({ id: "active-season", title: "Actual", status: "active" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.readRanking).toHaveBeenCalledWith(
      "get_season_ranking",
      { target_season_id: "active-season" },
      expect.any(Function),
    );
  });

  it("loads the latest finished season and preserves its points after closure", async () => {
    const query = seasonQuery({ id: "finished-season", title: "Temporada Alpha" });
    const model = await new SupabaseRoomRankingQueries().getRanking("tabarnia", context);
    expect(query.eq.mock.calls).toEqual([
      ["room_id", "room-id"],
      ["status", "finished"],
    ]);
    expect(query.order.mock.calls).toEqual([
      ["ends_at", { ascending: false }],
      ["starts_at", { ascending: false }],
      ["id"],
    ]);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(model?.season).toEqual({
      id: "finished-season",
      title: "Temporada Alpha",
      status: "finished",
    });
    expect(mocks.readRanking).toHaveBeenCalledWith(
      "get_season_ranking",
      { target_season_id: "finished-season" },
      expect.any(Function),
    );
    expect(model?.entries).toEqual([
      {
        rank: 1,
        memberId: "viewer",
        name: "Diego",
        initials: "DI",
        avatarSrc: undefined,
        flashPoints: 55,
      },
    ]);
  });

  it("uses the season deadline even if the calendar tick has not persisted its closure", async () => {
    mocks.readRoom.mockResolvedValue([
      {
        ...room,
        season_id: "expired-season",
        season_title: "Alpha",
        season_status: "active",
        season_ends_at: context.now,
      },
    ]);
    const model = await new SupabaseRoomRankingQueries().getRanking("tabarnia", context);
    expect(model?.season?.status).toBe("finished");
    expect(model?.entries[0]?.flashPoints).toBe(55);
  });

  it("keeps a room with no eligible season available and skips the ranking RPC", async () => {
    seasonQuery(null);
    await expect(
      new SupabaseRoomRankingQueries().getRanking("tabarnia", context),
    ).resolves.toMatchObject({ roomTitle: "Tabarnia", season: null, entries: [] });
    expect(mocks.readRanking).not.toHaveBeenCalled();
  });

  it("does not look up seasons for an unknown or inaccessible room", async () => {
    mocks.readRoom.mockResolvedValue([]);
    await expect(
      new SupabaseRoomRankingQueries().getRanking("other-room", context),
    ).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.readRanking).not.toHaveBeenCalled();
  });

  it("forwards a season lookup error instead of presenting an empty ranking", async () => {
    seasonQuery(null, { message: "connection failed" });
    await expect(new SupabaseRoomRankingQueries().getRanking("tabarnia", context)).rejects.toThrow(
      "Supabase ranking season read failed: connection failed",
    );
    expect(mocks.readRanking).not.toHaveBeenCalled();
  });
});
