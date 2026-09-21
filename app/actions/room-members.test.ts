import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  manageRoomMemberCommand: vi.fn(),
  isValidRoomMemberTarget: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/room-members", () => ({
  isValidRoomMemberTarget: mocks.isValidRoomMemberTarget,
  manageRoomMemberCommand: mocks.manageRoomMemberCommand,
}));

import { manageRoomMember } from "./room-members";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = {
  roomKey: "tabarnia-room",
  targetMemberKey: "marta",
  action: "grant_admin",
  idempotencyKey: "action-test-1",
};

describe("manageRoomMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isValidRoomMemberTarget.mockReturnValue(true);
    mocks.manageRoomMemberCommand.mockResolvedValue({ status: "active", role: "admin" });
  });

  it("validates form input before invoking a command", async () => {
    await expect(
      manageRoomMember({}, formData({ ...valid, idempotencyKey: "short" })),
    ).resolves.toEqual({
      ok: false,
      message: "No se ha podido preparar la operación. Recarga la página.",
    });
    expect(mocks.manageRoomMemberCommand).not.toHaveBeenCalled();
  });

  it("delegates the command and revalidates both room views", async () => {
    await expect(manageRoomMember({}, formData(valid))).resolves.toEqual({ ok: true });
    expect(mocks.manageRoomMemberCommand).toHaveBeenCalledWith(valid);
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/salas/tabarnia-room/ajustes");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/salas/tabarnia-room");
  });
});
