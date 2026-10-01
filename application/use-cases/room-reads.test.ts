import { describe, expect, it, vi } from "vitest";
import type {
  RoomHistoryQueries,
  RoomLobbyQueries,
  RoomMemberDetailQueries,
  RoomRankingQueries,
  RoomSettingsQueries,
} from "@/application/queries";
import { ApplicationRoomReads } from "@/application/use-cases/room-reads";
import type { QueryContext, RoomCardModel, ViewerProfile } from "@/types/view-models";

const viewer: ViewerProfile = {
  playerId: "canonical-player" as ViewerProfile["playerId"],
  id: "route-player",
  name: "Ana",
};

function createRoomReads(
  overrides: Partial<{
    currentViewer: { getCurrentViewer(): Promise<ViewerProfile | null> };
    lobby: RoomLobbyQueries;
    ranking: RoomRankingQueries;
    settings: RoomSettingsQueries;
    history: RoomHistoryQueries;
    memberDetail: RoomMemberDetailQueries;
  }> = {},
) {
  const listCards = vi.fn(async (context: QueryContext): Promise<RoomCardModel[]> => {
    void context;
    return [];
  });
  const lobby: RoomLobbyQueries = {
    listCards,
    getDetail: vi.fn(async () => null),
    getIntroduction: vi.fn(async () => null),
  };
  const ranking: RoomRankingQueries = { getRanking: vi.fn(async () => null) };
  const settings: RoomSettingsQueries = { getSettings: vi.fn(async () => null) };
  const history: RoomHistoryQueries = {
    listHistory: vi.fn(async () => null),
    getHistoryDetail: vi.fn(async () => null),
  };
  const getMemberDetail = vi.fn(async () => null);
  const memberDetail: RoomMemberDetailQueries = { getMemberDetail };
  const dependencies = {
    currentViewer: { getCurrentViewer: vi.fn(async () => viewer) },
    lobby,
    ranking,
    settings,
    history,
    memberDetail,
    clock: { now: vi.fn(() => "2026-10-01T10:00:00.000Z" as QueryContext["now"]) },
    ...overrides,
  };
  return {
    dependencies,
    lobby,
    listCards,
    getMemberDetail,
    reads: new ApplicationRoomReads(dependencies),
  };
}

describe("ApplicationRoomReads", () => {
  it("centralizes unauthenticated reads", async () => {
    const currentViewer = { getCurrentViewer: vi.fn(async () => null) };
    const { lobby, reads } = createRoomReads({ currentViewer });

    await expect(reads.getHome()).resolves.toBeNull();
    expect(currentViewer.getCurrentViewer).toHaveBeenCalledOnce();
    expect(lobby.listCards).not.toHaveBeenCalled();
  });

  it("builds one trusted context and delegates it without accepting route identity", async () => {
    const { dependencies, lobby, listCards, reads } = createRoomReads();
    await reads.getHome();

    expect(dependencies.currentViewer.getCurrentViewer).toHaveBeenCalledOnce();
    expect(dependencies.clock.now).toHaveBeenCalledOnce();
    expect(lobby.listCards).toHaveBeenCalledWith({
      viewer,
      now: "2026-10-01T10:00:00.000Z",
    });
    expect(listCards.mock.calls[0]?.[0].viewer.id).toBe("route-player");
    expect(listCards.mock.calls[0]?.[0].viewer.playerId).toBe("canonical-player");
  });

  it("passes the same server-built context to the requested capability", async () => {
    const { dependencies, getMemberDetail, reads } = createRoomReads();

    await reads.getMemberDetail("room-key", "member-key", "publication-key");

    expect(getMemberDetail).toHaveBeenCalledWith(
      "room-key",
      "member-key",
      {
        viewer,
        now: "2026-10-01T10:00:00.000Z",
      },
      "publication-key",
    );
    expect(dependencies.currentViewer.getCurrentViewer).toHaveBeenCalledOnce();
  });
});
