import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminRoomCommandError } from "@/application/administration/errors";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  lookupPlayers: vi.fn(),
  createRoom: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/server/admin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/server/admin-room", () => ({
  lookupSuperadminPlayers: mocks.lookupPlayers,
  createSuperadminRoom: mocks.createRoom,
}));

import { createPrivateRoom, lookupSuperadminPlayers } from "./actions";

function formData(values: Record<string, string | readonly string[]>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value]) form.append(key, entry);
  }
  return form;
}

function validForm(overrides: Record<string, string | readonly string[]> = {}) {
  return formData({
    title: "Sala beta",
    description: "Descripción",
    timeZone: "Europe/Madrid",
    ownerEmail: "owner@example.com",
    memberEmail: ["member@example.com"],
    memberRole: ["member"],
    reason: "Preparar beta",
    idempotencyKey: "room-create-123",
    ...overrides,
  });
}

describe("admin server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue({});
  });

  it("normalizes exact lookup emails before crossing the server façade", async () => {
    mocks.lookupPlayers.mockResolvedValue([
      {
        email: "owner@example.com",
        playerId: "00000000-0000-4000-8000-000000000001",
        displayName: "Owner",
      },
    ]);

    await expect(lookupSuperadminPlayers([" OWNER@example.com "])).resolves.toEqual({
      ok: true,
      candidates: [expect.objectContaining({ email: "owner@example.com" })],
    });
    expect(mocks.lookupPlayers).toHaveBeenCalledWith(["owner@example.com"]);
  });

  it("returns validation errors without invoking the creation command", async () => {
    const result = await createPrivateRoom(
      {},
      validForm({ title: "x", ownerEmail: "invalid", memberRole: ["owner"] }),
    );

    expect(result).toMatchObject({
      message: "Revisa los datos de la sala.",
      fieldErrors: {
        title: "Usa entre 3 y 80 caracteres.",
        ownerEmail: "Introduce un email válido.",
        members: "Cada miembro debe tener un rol válido.",
      },
    });
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });

  it("maps idempotency conflicts back to the form", async () => {
    mocks.createRoom.mockRejectedValue(new SuperadminRoomCommandError("idempotency_conflict"));

    const result = await createPrivateRoom({}, validForm());

    expect(result).toMatchObject({
      message: "Revisa los datos de la sala.",
      fieldErrors: { form: "Esta operación ya se usó con otros datos. Recarga el formulario." },
    });
  });

  it("revalidates the portal and redirects after a successful creation", async () => {
    mocks.createRoom.mockResolvedValue({
      roomId: "00000000-0000-4000-8000-000000000002",
      slug: "sala-beta",
      title: "Sala beta",
      timeZone: "Europe/Madrid",
      owner: { playerId: "00000000-0000-4000-8000-000000000001", displayName: "Owner" },
      memberCount: 2,
      source: "supabase",
    });

    await expect(createPrivateRoom({}, validForm())).rejects.toThrow("REDIRECT:/admin?created=1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(mocks.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerEmail: "owner@example.com",
        initialMembers: [{ email: "member@example.com", role: "member" }],
      }),
    );
  });
});
