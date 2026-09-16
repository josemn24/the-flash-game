import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SuperadminRoomCommandError } from "@/application/administration/errors";
import {
  SupabaseSuperadminPortalQueries,
  SupabaseSuperadminRoomCommands,
} from "./superadminQueries";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const context = {
  operator: {
    playerId: "00000000-0000-4000-8000-000000000001",
    displayName: "Superadmin",
  },
  rooms: [
    {
      roomId: "00000000-0000-4000-8000-000000000002",
      slug: "beta",
      title: "Sala beta",
      status: "active",
    },
  ],
};

describe("SupabaseSuperadminPortalQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("maps the validated portal context and marks its source", async () => {
    mocks.rpc.mockResolvedValue({ data: context, error: null });

    await expect(new SupabaseSuperadminPortalQueries().getContext()).resolves.toEqual({
      ...context,
      source: "supabase",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_superadmin_portal_context");
  });

  it("accepts an empty room list without inventing a room", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...context, rooms: [] }, error: null });

    await expect(new SupabaseSuperadminPortalQueries().getContext()).resolves.toMatchObject({
      rooms: [],
      source: "supabase",
    });
  });

  it("rejects an invalid payload instead of filtering or falling back", async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...context, rooms: [{ ...context.rooms[0], status: "deleted" }] },
      error: null,
    });

    await expect(new SupabaseSuperadminPortalQueries().getContext()).rejects.toThrow(
      "invalid context payload",
    );
  });

  it("turns the authorization SQL error into a typed denial", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "not_authorized" },
    });

    await expect(new SupabaseSuperadminPortalQueries().getContext()).rejects.toBeInstanceOf(
      SuperadminAccessDeniedError,
    );
  });

  it("propagates unexpected RPC failures", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "database unavailable" },
    });

    await expect(new SupabaseSuperadminPortalQueries().getContext()).rejects.toThrow(
      "database unavailable",
    );
  });

  it("maps exact player lookup rows without inventing missing candidates", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          email: "owner@example.com",
          player_id: "00000000-0000-4000-8000-000000000003",
          display_name: "Owner",
        },
      ],
      error: null,
    });

    await expect(
      new SupabaseSuperadminPortalQueries().lookupPlayersByEmail([" OWNER@example.com ", "missing@example.com"]),
    ).resolves.toEqual([
      {
        email: "owner@example.com",
        playerId: "00000000-0000-4000-8000-000000000003",
        displayName: "Owner",
      },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("lookup_superadmin_players", {
      target_emails: ["owner@example.com", "missing@example.com"],
    });
  });

  it("rejects invalid lookup rows", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ email: "owner@example.com", player_id: "not-a-uuid", display_name: "Owner" }],
      error: null,
    });

    await expect(new SupabaseSuperadminPortalQueries().lookupPlayersByEmail(["owner@example.com"])).rejects.toThrow(
      "invalid payload",
    );
  });

  it("maps a validated room creation result and propagates command errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        roomId: "00000000-0000-4000-8000-000000000004",
        slug: "sala-beta",
        title: "Sala beta",
        timeZone: "Europe/Madrid",
        owner: {
          playerId: "00000000-0000-4000-8000-000000000003",
          displayName: "Owner",
        },
        memberCount: 1,
      },
      error: null,
    });

    await expect(new SupabaseSuperadminRoomCommands().createRoom({
      idempotencyKey: "room-create-1",
      title: "Sala beta",
      description: "",
      timeZone: "Europe/Madrid",
      ownerEmail: "owner@example.com",
      initialMembers: [],
      reason: "Beta",
    })).resolves.toMatchObject({ source: "supabase", slug: "sala-beta", memberCount: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("create_superadmin_room", {
      input: expect.objectContaining({ ownerEmail: "owner@example.com" }),
    });

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "owner_not_found" } });
    await expect(new SupabaseSuperadminRoomCommands().createRoom({
      idempotencyKey: "room-create-2",
      title: "Sala beta",
      description: "",
      timeZone: "Europe/Madrid",
      ownerEmail: "missing@example.com",
      initialMembers: [],
      reason: "Beta",
    })).rejects.toMatchObject({ code: "owner_not_found" });

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "offline" } });
    await expect(new SupabaseSuperadminRoomCommands().createRoom({
      idempotencyKey: "room-create-3",
      title: "Sala beta",
      description: "",
      timeZone: "Europe/Madrid",
      ownerEmail: "owner@example.com",
      initialMembers: [],
      reason: "Beta",
    })).rejects.toBeInstanceOf(SuperadminRoomCommandError);
  });
});
