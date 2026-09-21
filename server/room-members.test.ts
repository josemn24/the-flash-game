import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isMockRoomRoute: vi.fn(),
  isMockRoomRouteEnabled: vi.fn(),
  mockCommand: vi.fn(),
  supabaseCommand: vi.fn(),
}));

vi.mock("@/infrastructure/mock/composition", () => ({
  isMockRoomRoute: mocks.isMockRoomRoute,
  isMockRoomRouteEnabled: mocks.isMockRoomRouteEnabled,
  mockRoomMembershipCommands: { manageMember: mocks.mockCommand },
}));
vi.mock("@/infrastructure/supabase/roomMembershipCommands", () => ({
  supabaseRoomMembershipCommands: { manageMember: mocks.supabaseCommand },
}));

import { isValidRoomMemberTarget, manageRoomMemberCommand } from "./room-members";

const input = {
  roomKey: "tabarnia-room",
  targetMemberKey: "marta",
  action: "grant_admin" as const,
  idempotencyKey: "server-test-1",
};

describe("room member server facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMockRoomRoute.mockReturnValue(true);
    mocks.isMockRoomRouteEnabled.mockReturnValue(true);
    mocks.mockCommand.mockResolvedValue({ status: "active", role: "admin" });
    mocks.supabaseCommand.mockResolvedValue({ status: "active", role: "admin" });
  });

  it("selects the mock adapter only for enabled mock routes", async () => {
    await expect(manageRoomMemberCommand(input)).resolves.toEqual({
      status: "active",
      role: "admin",
    });
    expect(mocks.mockCommand).toHaveBeenCalledWith(input);
    expect(mocks.supabaseCommand).not.toHaveBeenCalled();
  });

  it("selects Supabase for persisted room routes", async () => {
    mocks.isMockRoomRouteEnabled.mockReturnValue(false);

    await expect(
      manageRoomMemberCommand({
        ...input,
        roomKey: "persisted-room",
        targetMemberKey: "00000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toEqual({ status: "active", role: "admin" });
    expect(mocks.supabaseCommand).toHaveBeenCalled();
    expect(mocks.mockCommand).not.toHaveBeenCalled();
  });

  it("accepts UUID targets and aliases only for known mock rooms", () => {
    mocks.isMockRoomRoute.mockReturnValue(true);
    expect(isValidRoomMemberTarget("tabarnia-room", "marta")).toBe(true);
    expect(isValidRoomMemberTarget("tabarnia-room", "00000000-0000-4000-8000-000000000002")).toBe(true);

    mocks.isMockRoomRoute.mockReturnValue(false);
    expect(isValidRoomMemberTarget("persisted-room", "marta")).toBe(false);
    expect(isValidRoomMemberTarget("persisted-room", "00000000-0000-4000-8000-000000000002")).toBe(true);
  });
});
