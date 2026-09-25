import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  mockCommand: vi.fn(),
  supabaseCommand: vi.fn(),
  isMockRoomRoute: vi.fn(),
  isMockRoomRouteEnabled: vi.fn(),
  mocksEnabled: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/infrastructure/mock/composition", () => ({
  isMockRoomRoute: mocks.isMockRoomRoute,
  isMockRoomRouteEnabled: mocks.isMockRoomRouteEnabled,
  mockRoomMembershipCommands: { manageMember: mocks.mockCommand },
}));
vi.mock("@/infrastructure/supabase/roomMembershipCommands", () => ({
  supabaseRoomMembershipCommands: { manageMember: mocks.supabaseCommand },
}));
vi.mock("@/server/runtime-scope", () => ({ mocksEnabled: mocks.mocksEnabled }));

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
    mocks.mocksEnabled.mockReturnValue(true);
    mocks.isMockRoomRoute.mockReturnValue(true);
    mocks.isMockRoomRouteEnabled.mockReturnValue(true);
    mocks.mockCommand.mockResolvedValue({ status: "active", role: "admin" });
    mocks.supabaseCommand.mockResolvedValue({ status: "active", role: "admin" });
  });

  it("validates form input before invoking a command", async () => {
    await expect(
      manageRoomMember({}, formData({ ...valid, idempotencyKey: "short" })),
    ).resolves.toEqual({
      ok: false,
      message: "No se ha podido preparar la operación. Recarga la página.",
    });
    expect(mocks.mockCommand).not.toHaveBeenCalled();
    expect(mocks.supabaseCommand).not.toHaveBeenCalled();
  });

  it("uses the mock command and revalidates both room views", async () => {
    await expect(manageRoomMember({}, formData(valid))).resolves.toEqual({ ok: true });
    expect(mocks.mockCommand).toHaveBeenCalledWith(valid);
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/salas/tabarnia-room/ajustes");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/salas/tabarnia-room");
  });

  it("uses Supabase for real room routes", async () => {
    mocks.isMockRoomRoute.mockReturnValue(false);
    mocks.isMockRoomRouteEnabled.mockReturnValue(false);

    await expect(
      manageRoomMember(
        {},
        formData({
          ...valid,
          roomKey: "tabarnia",
          targetMemberKey: "00000000-0000-4000-8000-000000000002",
        }),
      ),
    ).resolves.toEqual({ ok: true });
    expect(mocks.supabaseCommand).toHaveBeenCalled();
    expect(mocks.mockCommand).not.toHaveBeenCalled();
  });
});
