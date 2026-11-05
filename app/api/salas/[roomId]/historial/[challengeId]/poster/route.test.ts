import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRoomHistoryDetailPageModel: vi.fn(),
  generateRankingPoster: vi.fn(),
}));

vi.mock("@/server/production-room-data-access", () => ({
  getRoomHistoryDetailPageModel: mocks.getRoomHistoryDetailPageModel,
}));
vi.mock("@/features/flash-pop/ranking-poster/renderRankingPoster", () => ({
  generateRankingPoster: mocks.generateRankingPoster,
}));

import { GET } from "./route";

const roomId = "tabarnia-room";
const challengeId = "challenge-123";
const ranking = [
  {
    rank: 1,
    memberId: "player-1",
    name: "Dark",
    initials: "D",
    flashPoints: 98,
    avatarSrc: undefined,
    completed: true,
    durationMs: 1_000,
    startedAt: "2026-10-31T10:00:00.000Z",
  },
];

const historyDetail = (overrides: Record<string, unknown> = {}) => ({
  roomId,
  roomTitle: "Tabarnia",
  currentUserId: "owner-1",
  entry: {
    id: challengeId,
    challengeId,
    mode: "flash",
    title: "Cumbre lógica",
    formatLabel: "Flash",
    subtitle: "",
    questionCount: 10,
    maxScore: 100,
    playedAt: "2026-10-31T10:00:00.000Z",
    imageSrc: "",
    playerCount: 1,
  },
  ranking,
  canExportRankingPoster: true,
  ...overrides,
});

const context = () => ({ params: Promise.resolve({ roomId, challengeId }) });
const request = () =>
  new Request(`http://localhost/api/salas/${roomId}/historial/${challengeId}/poster`);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getRoomHistoryDetailPageModel.mockResolvedValue(historyDetail());
  mocks.generateRankingPoster.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
});

describe("challenge ranking poster route", () => {
  it("returns a private PNG download from the official ranking model", async () => {
    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ranking-tabarnia-room-cumbre-logica.png"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(mocks.generateRankingPoster).toHaveBeenCalledWith({
      roomTitle: "Tabarnia",
      challengeTitle: "Cumbre lógica",
      playedAt: "2026-10-31T10:00:00.000Z",
      ranking,
    });
  });

  it.each(["member", "spectator"])("denies %s access to the download", async () => {
    mocks.getRoomHistoryDetailPageModel.mockResolvedValue(
      historyDetail({ canExportRankingPoster: false }),
    );

    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(mocks.generateRankingPoster).not.toHaveBeenCalled();
  });

  it("returns not found when the closed challenge is unavailable to the viewer", async () => {
    mocks.getRoomHistoryDetailPageModel.mockResolvedValue(null);

    const response = await GET(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "ranking_not_found" });
  });

  it("does not render a PNG when the closed challenge has no results", async () => {
    mocks.getRoomHistoryDetailPageModel.mockResolvedValue(historyDetail({ ranking: [] }));

    const response = await GET(request(), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "ranking_empty" });
    expect(mocks.generateRankingPoster).not.toHaveBeenCalled();
  });
});
