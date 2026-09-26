import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminUserCommandError } from "@/application/administration/errors";

const mocks = vi.hoisted(() => ({
  requireSuperadmin: vi.fn(),
  createAccount: vi.fn(),
  addMember: vi.fn(),
  lookupPlayers: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/admin", () => ({ requireSuperadmin: mocks.requireSuperadmin }));
vi.mock("@/server/admin-users", () => ({
  createSuperadminPlayerAccount: mocks.createAccount,
  addSuperadminRoomMember: mocks.addMember,
  lookupSuperadminPlayers: mocks.lookupPlayers,
}));

import { addPortalUserToRoom, createPortalUser, lookupPortalUserByEmail } from "./user-actions";

const roomId = "00000000-0000-4000-8000-000000000001";
const playerId = "00000000-0000-4000-8000-000000000002";
const context = {
  actor: {
    playerId: "00000000-0000-4000-8000-000000000003",
    displayName: "Operador",
    requestId: "request-1",
  },
  context: {
    operator: { playerId: "00000000-0000-4000-8000-000000000003", displayName: "Operador" },
    rooms: [
      {
        roomId,
        slug: "beta",
        title: "Sala beta",
        timeZone: "UTC",
        status: "active" as const,
        seasons: [],
      },
    ],
  },
};

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  return form;
}

describe("superadmin user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperadmin.mockResolvedValue(context);
  });

  it("validates account fields before calling Auth", async () => {
    const result = await createPortalUser(
      {},
      formData({
        email: "invalid",
        password: "short",
        displayName: "A",
        reason: "",
        idempotencyKey: "key-123456",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        email: expect.any(String),
        password: expect.any(String),
        displayName: expect.any(String),
        reason: expect.any(String),
      },
    });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("normalizes email and returns no password after creating an account", async () => {
    mocks.createAccount.mockResolvedValue({ playerId, displayName: "Nuevo jugador" });

    const result = await createPortalUser(
      {},
      formData({
        email: "  NUEVO@example.com ",
        password: "initial-password-123",
        displayName: "Nuevo jugador",
        reason: "Alta para beta",
        idempotencyKey: "user-create-123",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      message: expect.stringContaining("No se ha enviado"),
    });
    expect(JSON.stringify(result)).not.toContain("initial-password-123");
    expect(mocks.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@example.com",
        password: "initial-password-123",
        displayName: "Nuevo jugador",
        actorPlayerId: context.actor.playerId,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("maps duplicate Auth emails to the email field", async () => {
    mocks.createAccount.mockRejectedValue(
      new SuperadminUserCommandError("email_already_registered"),
    );

    const result = await createPortalUser(
      {},
      formData({
        email: "user@example.com",
        password: "initial-password-123",
        displayName: "New User",
        reason: "Alta",
        idempotencyKey: "user-create-456",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.stringContaining("Ya existe") },
    });
  });

  it("looks up a normalized existing member by email", async () => {
    mocks.lookupPlayers.mockResolvedValue([
      { email: "user@example.com", playerId, displayName: "User" },
    ]);

    await expect(lookupPortalUserByEmail(" USER@example.com ")).resolves.toEqual({
      ok: true,
      candidate: { email: "user@example.com", playerId, displayName: "User" },
    });
  });

  it.each(["admin", "member", "spectator"] as const)(
    "adds a user with the %s role",
    async (role) => {
      mocks.addMember.mockResolvedValue({});

      await expect(
        addPortalUserToRoom(
          {},
          formData({
            roomId,
            targetPlayerId: playerId,
            role,
            reason: "Incorporación a beta",
            idempotencyKey: `add-${role}-123456`,
          }),
        ),
      ).rejects.toThrow(`REDIRECT:/admin/rooms/${roomId}?tab=members&member=added`);
      expect(mocks.addMember).toHaveBeenCalledWith(
        expect.objectContaining({ roomId, targetPlayerId: playerId, role }),
      );
    },
  );

  it("does not allow owner assignment or rooms outside the superadmin context", async () => {
    const result = await addPortalUserToRoom(
      {},
      formData({
        roomId,
        targetPlayerId: playerId,
        role: "owner",
        reason: "Propietario",
        idempotencyKey: "add-owner-123456",
      }),
    );

    expect(result).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    expect(mocks.addMember).not.toHaveBeenCalled();
  });
});
