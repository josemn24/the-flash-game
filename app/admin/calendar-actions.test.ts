import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  createCommand: vi.fn(),
  updateCommand: vi.fn(),
  getContext: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/admin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/server/admin-calendar", () => ({
  createScheduledChallenge: mocks.createCommand,
  updateScheduledChallenge: mocks.updateCommand,
  getSuperadminCalendarContext: mocks.getContext,
}));

import { createScheduledChallenge, updateScheduledChallenge } from "./calendar-actions";

const roomId = "00000000-0000-4000-8000-000000000001";
const seasonId = "00000000-0000-4000-8000-000000000002";
const contentId = "00000000-0000-4000-8000-000000000003";
const scheduleId = "00000000-0000-4000-8000-000000000004";
const context = {
  operator: { playerId: "00000000-0000-4000-8000-000000000005", displayName: "Operador" },
  rooms: [
    {
      roomId,
      slug: "beta",
      title: "Sala beta",
      timeZone: "Europe/Madrid",
      status: "active" as const,
      seasons: [
        {
          seasonId,
          title: "Temporada activa",
          status: "active" as const,
          startsAt: "2026-09-20T10:00:00.000Z",
          endsAt: "2026-10-20T10:00:00.000Z",
        },
      ],
    },
  ],
  source: "supabase" as const,
};

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return form;
}

function scheduleForm(overrides: Record<string, string> = {}) {
  return formData({
    seasonId,
    challengeVersionId: contentId,
    number: "1",
    opensAtLocal: "2030-09-20T12:30",
    closesAtLocal: "2030-09-20T13:30",
    reason: "Preparar calendario",
    idempotencyKey: "calendar-create-1",
    ...overrides,
  });
}

describe("calendar admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({ context });
  });

  it("creates a challenge and returns to the selected room calendar", async () => {
    mocks.createCommand.mockResolvedValue({});

    await expect(createScheduledChallenge({}, scheduleForm())).rejects.toThrow(
      `REDIRECT:/admin/rooms/${roomId}?tab=calendar&calendar=created`,
    );
    expect(mocks.createCommand).toHaveBeenCalledWith(expect.objectContaining({ seasonId }));
  });

  it("reprograms only a publication read from the submitted room", async () => {
    mocks.getContext.mockResolvedValue({
      entries: [
        {
          scheduledChallengeId: scheduleId,
          roomId,
          roomSlug: "beta",
          roomTitle: "Sala beta",
          timeZone: "Europe/Madrid",
          seasonId,
          seasonTitle: "Temporada activa",
          seasonStatus: "active",
          challengeVersionId: contentId,
          challengeSlug: "flash",
          versionNumber: 1,
          challengeTitle: "Flash",
          challengeSubtitle: "",
          mode: "flash",
          number: 1,
          status: "scheduled",
          opensAt: "2030-09-20T10:30:00.000Z",
          closesAt: "2030-09-20T11:30:00.000Z",
          updatedAt: "2030-09-20T09:30:00.000Z",
        },
      ],
    });
    mocks.updateCommand.mockResolvedValue({});

    await expect(
      updateScheduledChallenge(
        {},
        scheduleForm({
          roomId,
          scheduledChallengeId: scheduleId,
          expectedUpdatedAt: "2030-09-20T09:30:00.000Z",
          idempotencyKey: "calendar-update-1",
          reason: "Ajustar calendario",
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/admin/rooms/${roomId}?tab=calendar&calendar=updated`);
    expect(mocks.getContext).toHaveBeenCalledWith(roomId);
    expect(mocks.updateCommand).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledChallengeId: scheduleId }),
    );
  });
});
