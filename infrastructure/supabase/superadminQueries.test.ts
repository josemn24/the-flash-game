import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuperadminAccessDeniedError } from "@/application/administration/errors";
import { SupabaseSuperadminPortalQueries } from "./superadminQueries";

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
});
