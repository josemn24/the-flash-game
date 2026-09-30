import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseCurrentViewerReader } from "./currentViewer";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  authGetUser: vi.fn(),
  provisionPlayer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

describe("supabase current viewer reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.authGetUser },
      rpc: mocks.provisionPlayer,
    });
  });

  it("returns null when there is no authenticated session", async () => {
    mocks.authGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(supabaseCurrentViewerReader.getCurrentViewer()).resolves.toBeNull();
    expect(mocks.provisionPlayer).not.toHaveBeenCalled();
  });

  it("validates and maps the provisioned player", async () => {
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-id" } },
      error: null,
    });
    mocks.provisionPlayer.mockResolvedValue({
      data: [
        {
          player_id: "00000000-0000-0000-0000-000000000001",
          display_name: "Alice",
          avatar_path: null,
          status: "active",
        },
      ],
      error: null,
    });

    await expect(supabaseCurrentViewerReader.getCurrentViewer()).resolves.toEqual({
      playerId: "00000000-0000-0000-0000-000000000001",
      id: "00000000-0000-0000-0000-000000000001",
      name: "Alice",
      avatarSrc: undefined,
    });
    expect(mocks.provisionPlayer).toHaveBeenCalledWith("provision_player");
  });

  it("preserves the provisioning error for an invalid player row", async () => {
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-id" } },
      error: null,
    });
    mocks.provisionPlayer.mockResolvedValue({ data: [{ player_id: "missing" }], error: null });

    await expect(supabaseCurrentViewerReader.getCurrentViewer()).rejects.toThrow(
      "The authenticated Player could not be provisioned.",
    );
  });
});
