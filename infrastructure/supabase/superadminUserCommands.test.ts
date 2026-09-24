import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SupabaseSuperadminUserCommands } from "./superadminUserCommands";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/infrastructure/supabase/superadminQueries", () => ({
  supabaseSuperadminPortalQueries: { lookupPlayersByEmail: vi.fn() },
}));

const roomId = "00000000-0000-4000-8000-000000000001";
const playerId = "00000000-0000-4000-8000-000000000002";

describe("SupabaseSuperadminUserCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("calls the player provisioning RPC with only profile data", async () => {
    mocks.rpc.mockResolvedValue({ data: { playerId, displayName: "Nuevo" }, error: null });
    await expect(
      new SupabaseSuperadminUserCommands().createPlayer({
        idempotencyKey: "create-profile-1",
        authUserId: playerId,
        displayName: "Nuevo",
        reason: "Alta",
      }),
    ).resolves.toEqual({ playerId, displayName: "Nuevo" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_superadmin_player", {
      input: expect.objectContaining({ authUserId: playerId, displayName: "Nuevo" }),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("password");
  });

  it("calls the membership RPC and validates a successful result", async () => {
    mocks.rpc.mockResolvedValue({
      data: { roomId, playerId, role: "spectator", status: "active", reactivated: false },
      error: null,
    });
    await expect(
      new SupabaseSuperadminUserCommands().addRoomMember({
        idempotencyKey: "add-member-1",
        roomId,
        targetPlayerId: playerId,
        role: "spectator",
        reason: "Alta",
      }),
    ).resolves.toMatchObject({ roomId, playerId, role: "spectator", reactivated: false });
    expect(mocks.rpc).toHaveBeenCalledWith("add_superadmin_room_member", {
      input: expect.objectContaining({ targetPlayerId: playerId, role: "spectator" }),
    });
  });

  it("maps authorization and rejects malformed responses", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });
    await expect(
      new SupabaseSuperadminUserCommands().addRoomMember({
        idempotencyKey: "add-member-2",
        roomId,
        targetPlayerId: playerId,
        role: "member",
        reason: "Alta",
      }),
    ).rejects.toBeInstanceOf(SuperadminAccessDeniedError);

    mocks.rpc.mockResolvedValue({
      data: { roomId, playerId, role: "owner", status: "active" },
      error: null,
    });
    await expect(
      new SupabaseSuperadminUserCommands().addRoomMember({
        idempotencyKey: "add-member-3",
        roomId,
        targetPlayerId: playerId,
        role: "member",
        reason: "Alta",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});
