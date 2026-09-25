import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseRoomMembershipCommands } from "./roomMembershipCommands";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const input = {
  idempotencyKey: "member-command-1",
  roomKey: "tabarnia",
  targetMemberKey: "00000000-0000-4000-8000-000000000002",
  action: "grant_admin" as const,
};

const result = {
  roomKey: input.roomKey,
  targetPlayerId: input.targetMemberKey,
  action: input.action,
  role: "admin" as const,
  status: "active" as const,
};

describe("SupabaseRoomMembershipCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("calls the narrow RPC and maps the target player to the room member key", async () => {
    mocks.rpc.mockResolvedValue({ data: result, error: null });

    await expect(new SupabaseRoomMembershipCommands().manageMember(input)).resolves.toEqual({
      ...result,
      targetMemberKey: input.targetMemberKey,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("manage_room_member", {
      input: {
        idempotencyKey: input.idempotencyKey,
        roomKey: input.roomKey,
        targetPlayerId: input.targetMemberKey,
        action: input.action,
      },
    });
  });

  it("maps authorization, idempotency and domain errors without falling back", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });
    await expect(new SupabaseRoomMembershipCommands().manageMember(input)).rejects.toMatchObject({
      code: "not_authorized",
      name: "RoomMembershipCommandError",
    });

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "idempotency_conflict" },
    });
    await expect(
      new SupabaseRoomMembershipCommands().manageMember({
        ...input,
        idempotencyKey: "member-command-2",
        action: "revoke_admin",
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("rejects malformed inputs and responses", async () => {
    await expect(
      new SupabaseRoomMembershipCommands().manageMember({
        ...input,
        targetMemberKey: "not-a-uuid",
      }),
    ).rejects.toMatchObject({ code: "invalid_command" });

    mocks.rpc.mockResolvedValue({ data: { ...result, role: "unknown" }, error: null });
    await expect(new SupabaseRoomMembershipCommands().manageMember(input)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
