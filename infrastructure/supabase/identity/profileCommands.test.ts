import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProvisionedCurrentPlayer } from "./currentViewer";
import { supabaseProfileCommandsFor } from "./profileCommands";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/assets/publicAvatar", () => ({
  resolveAvatarPath: (path: string | null) => (path ? `/avatars/${path}` : undefined),
}));

describe("supabase profile commands", () => {
  const current = {
    supabase: { from: mocks.from, rpc: mocks.rpc },
    authUserId: "auth-user-id",
    row: { player_id: "player-1" },
  } as unknown as ProvisionedCurrentPlayer;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it("updates the provided player and returns the RLS-read profile without provisioning", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "player-1",
        display_name: "Updated Alice",
        avatar_path: "avatars/alice.png",
        status: "active",
      },
      error: null,
    });

    await expect(
      supabaseProfileCommandsFor(current).updateName({ name: "Updated Alice" }),
    ).resolves.toEqual({
      profile: {
        id: "player-1",
        name: "Updated Alice",
        avatarSrc: "/avatars/avatars/alice.png",
      },
    });
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Updated Alice" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "player-1");
    expect(mocks.select).toHaveBeenCalledWith("id, display_name, avatar_path, status");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps update and returned-row failures to profile_update_failed", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "update failed" },
    });

    await expect(
      supabaseProfileCommandsFor(current).updateName({ name: "Updated Alice" }),
    ).rejects.toThrow("profile_update_failed");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an updated player that is no longer active", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "player-1",
        display_name: "Updated Alice",
        avatar_path: null,
        status: "anonymized",
      },
      error: null,
    });

    await expect(
      supabaseProfileCommandsFor(current).updateName({ name: "Updated Alice" }),
    ).rejects.toThrow("profile_update_failed");
  });
});
