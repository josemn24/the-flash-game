import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SupabaseSuperadminDashboardQueries } from "./superadminDashboardQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const operator = {
  playerId: "00000000-0000-4000-8000-000000000001",
  displayName: "Superadmin",
};

const emptyDashboard = {
  operator,
  metrics: {
    activeRooms: 0,
    activeSeasons: 0,
    pendingSeasons: 0,
    editorialDrafts: 0,
    upcomingChallenges: 0,
  },
  rooms: [],
  upcomingChallenges: [],
};

describe("SupabaseSuperadminDashboardQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("maps an empty dashboard without inventing operational data", async () => {
    mocks.rpc.mockResolvedValue({ data: emptyDashboard, error: null });

    await expect(new SupabaseSuperadminDashboardQueries().getDashboard()).resolves.toEqual({
      ...emptyDashboard,
      alerts: [expect.objectContaining({ id: "no-active-rooms" })],
      actions: expect.arrayContaining([
        expect.objectContaining({ href: "/admin/rooms" }),
        expect.objectContaining({ href: "/admin/challenges" }),
      ]),
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_dashboard_context");
  });

  it("derives compact alerts from valid summary metrics", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ...emptyDashboard,
        metrics: {
          ...emptyDashboard.metrics,
          activeRooms: 1,
          activeSeasons: 1,
          editorialDrafts: 2,
        },
        rooms: [
          {
            roomId: "00000000-0000-4000-8000-000000000002",
            slug: "beta",
            title: "Sala beta",
            timeZone: "Europe/Madrid",
            seasonCount: 1,
            activeSeason: {
              title: "Temporada beta",
              startsAt: "2026-09-20T10:00:00.000Z",
              endsAt: "2026-10-20T10:00:00.000Z",
            },
          },
        ],
      },
      error: null,
    });

    await expect(new SupabaseSuperadminDashboardQueries().getDashboard()).resolves.toMatchObject({
      alerts: [
        expect.objectContaining({ id: "editorial-drafts" }),
        expect.objectContaining({ id: "no-upcoming-challenges" }),
      ],
    });
  });

  it("turns the authorization SQL error into a typed denial", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });

    await expect(new SupabaseSuperadminDashboardQueries().getDashboard()).rejects.toBeInstanceOf(
      SuperadminAccessDeniedError,
    );
  });

  it("rejects an invalid payload instead of exposing an incomplete model", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...emptyDashboard, metrics: { activeRooms: 0 } },
      error: null,
    });

    await expect(new SupabaseSuperadminDashboardQueries().getDashboard()).rejects.toThrow(
      "invalid payload",
    );
  });
});
