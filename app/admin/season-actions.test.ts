import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminSeasonCommandError } from "@/application/administration/errors";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  createSeason: vi.fn(),
  updateSeason: vi.fn(),
  activateSeason: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/admin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/server/admin-season", () => ({
  createSuperadminSeason: mocks.createSeason,
  updateSuperadminSeason: mocks.updateSeason,
  activateSuperadminSeason: mocks.activateSeason,
}));

import { activateSeason, createSeasonDraft, updateSeasonDraft } from "./season-actions";

const room = {
  roomId: "00000000-0000-4000-8000-000000000001",
  slug: "beta",
  title: "Sala beta",
  timeZone: "Europe/Madrid",
  status: "active" as const,
  seasons: [
    {
      seasonId: "00000000-0000-4000-8000-000000000002",
      title: "Temporada inicial",
      status: "draft" as const,
      startsAt: "2026-09-20T10:30:00.000Z",
      endsAt: "2026-09-27T10:30:00.000Z",
    },
  ],
};
const context = {
  operator: { playerId: "00000000-0000-4000-8000-000000000003", displayName: "Operador" },
  rooms: [room],
  source: "supabase" as const,
};

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return form;
}

function createForm(overrides: Partial<Record<string, string>> = {}) {
  return formData({
    roomId: room.roomId,
    title: "Temporada otoño",
    startsAtLocal: "2026-09-20T12:30",
    endsAtLocal: "2026-09-27T12:30",
    reason: "Preparar beta",
    idempotencyKey: "season-create-1",
    ...overrides,
  });
}

describe("season admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({ context });
  });

  it("converts room-local dates to UTC before creating a draft", async () => {
    mocks.createSeason.mockResolvedValue({});

    await expect(createSeasonDraft({}, createForm())).rejects.toThrow(
      "REDIRECT:/admin?season=created",
    );
    expect(mocks.createSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: "2026-09-20T10:30:00.000Z",
        endsAt: "2026-09-27T10:30:00.000Z",
        roomId: room.roomId,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("rejects nonexistent DST times before crossing the command boundary", async () => {
    const result = await createSeasonDraft({}, createForm({ startsAtLocal: "2026-03-29T02:30" }));

    expect(result).toMatchObject({
      fieldErrors: { startsAtLocal: expect.stringContaining("no existe") },
    });
    expect(mocks.createSeason).not.toHaveBeenCalled();
  });

  it("resolves a draft room from the authorized portal context when updating", async () => {
    mocks.updateSeason.mockResolvedValue({});

    await expect(
      updateSeasonDraft(
        {},
        formData({
          seasonId: room.seasons[0].seasonId,
          title: "Temporada editada",
          startsAtLocal: "2026-09-20T12:30",
          endsAtLocal: "2026-09-27T12:30",
          reason: "Ajustar fechas",
          idempotencyKey: "season-update-1",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin?season=updated");
    expect(mocks.updateSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonId: room.seasons[0].seasonId,
        startsAt: "2026-09-20T10:30:00.000Z",
      }),
    );
  });

  it("maps activation conflicts back to the portal form", async () => {
    mocks.activateSeason.mockRejectedValue(
      new SuperadminSeasonCommandError("active_season_exists"),
    );

    const result = await activateSeason(
      {},
      formData({
        seasonId: room.seasons[0].seasonId,
        reason: "Abrir temporada",
        idempotencyKey: "season-activate-1",
      }),
    );

    expect(result).toMatchObject({
      message: "Revisa los datos de la temporada.",
      fieldErrors: { form: "La sala ya tiene otra temporada activa." },
    });
  });
});
