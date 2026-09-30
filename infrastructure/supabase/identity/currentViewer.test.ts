import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProvisionedCurrentPlayer } from "./currentViewer";
import {
  getProvisionedCurrentPlayer,
  supabaseCurrentViewerReader,
  supabaseCurrentViewerReaderFor,
} from "./currentViewer";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  authGetUser: vi.fn(),
  provisionPlayer: vi.fn(),
  playersFrom: vi.fn(),
  playersSelect: vi.fn(),
  playersEq: vi.fn(),
  playersMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/media/publicAvatar", () => ({
  resolveAvatarPath: (path: string | null) => (path ? `/avatars/${path}` : undefined),
}));

describe("supabase current viewer reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.authGetUser },
      rpc: mocks.provisionPlayer,
      from: mocks.playersFrom,
    });
    mocks.playersFrom.mockReturnValue({ select: mocks.playersSelect });
    mocks.playersSelect.mockReturnValue({ eq: mocks.playersEq });
    mocks.playersEq.mockReturnValue({ maybeSingle: mocks.playersMaybeSingle });
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
    expect(mocks.provisionPlayer).toHaveBeenCalledOnce();
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

  it("reads a provisioned player through RLS without provisioning again", async () => {
    const current = {
      supabase: { from: mocks.playersFrom },
      authUserId: "auth-user-id",
      row: { player_id: "player-1" },
    } as unknown as ProvisionedCurrentPlayer;
    mocks.playersMaybeSingle.mockResolvedValue({
      data: {
        id: "player-1",
        display_name: "Updated Alice",
        avatar_path: "avatars/alice.png",
        status: "active",
      },
      error: null,
    });

    await expect(supabaseCurrentViewerReaderFor(current).getCurrentViewer()).resolves.toEqual({
      playerId: "player-1",
      id: "player-1",
      name: "Updated Alice",
      avatarSrc: "/avatars/avatars/alice.png",
    });
    expect(mocks.provisionPlayer).not.toHaveBeenCalled();
    expect(mocks.playersSelect).toHaveBeenCalledWith("id, display_name, avatar_path, status");
    expect(mocks.playersEq).toHaveBeenCalledWith("id", "player-1");
  });

  it("returns null when the contextual RLS read finds no active player", async () => {
    const current = {
      supabase: { from: mocks.playersFrom },
      authUserId: "auth-user-id",
      row: { player_id: "player-1" },
    } as unknown as ProvisionedCurrentPlayer;
    mocks.playersMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(supabaseCurrentViewerReaderFor(current).getCurrentViewer()).resolves.toBeNull();
    expect(mocks.provisionPlayer).not.toHaveBeenCalled();
  });

  it("translates contextual RLS read failures to a profile read error", async () => {
    const current = {
      supabase: { from: mocks.playersFrom },
      authUserId: "auth-user-id",
      row: { player_id: "player-1" },
    } as unknown as ProvisionedCurrentPlayer;
    mocks.playersMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(supabaseCurrentViewerReaderFor(current).getCurrentViewer()).rejects.toThrow(
      "The authenticated Player could not be read.",
    );
    expect(mocks.provisionPlayer).not.toHaveBeenCalled();
  });

  it("returns the authenticated client and row from the single provisioning call", async () => {
    mocks.authGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-id" } },
      error: null,
    });
    mocks.provisionPlayer.mockResolvedValue({
      data: [
        {
          player_id: "player-1",
          display_name: "Alice",
          avatar_path: null,
          status: "active",
        },
      ],
      error: null,
    });

    const current = await getProvisionedCurrentPlayer();

    expect(current).toMatchObject({ authUserId: "auth-user-id", row: { player_id: "player-1" } });
    expect(mocks.provisionPlayer).toHaveBeenCalledOnce();
  });
});
