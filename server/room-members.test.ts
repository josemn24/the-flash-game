import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseCommand: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/rooms/commands/roomMembershipCommands", () => ({
  supabaseRoomMembershipCommands: { manageMember: mocks.supabaseCommand },
}));

import { isValidRoomMemberTarget, manageRoomMemberCommand } from "./production-room-members";

const input = {
  roomKey: "tabarnia",
  targetMemberKey: "00000000-0000-4000-8000-000000000002",
  action: "grant_admin" as const,
  idempotencyKey: "server-test-1",
};

describe("room member server facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseCommand.mockResolvedValue({ status: "active", role: "admin" });
  });

  it("always delegates membership changes to Supabase", async () => {
    await expect(manageRoomMemberCommand(input)).resolves.toEqual({
      status: "active",
      role: "admin",
    });
    expect(mocks.supabaseCommand).toHaveBeenCalledWith(input);
  });

  it("accepts only UUID member targets", () => {
    expect(isValidRoomMemberTarget("tabarnia", "marta")).toBe(false);
    expect(isValidRoomMemberTarget("tabarnia", "00000000-0000-4000-8000-000000000002")).toBe(true);
  });
});
