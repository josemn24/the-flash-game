import { describe, expect, it, vi } from "vitest";
import type { MediaAssetCommands } from "@/application/ports/media-asset-commands";
import type { MediaStorage } from "@/application/ports/media-storage";
import type { ProfileCommands } from "@/application/ports/profile-commands";
import { ApplicationProfileUseCases } from "@/application/use-cases/profile";
import type { PlayerId } from "@/types/domain/identifiers";

const profile = {
  id: "player-1",
  name: "Ana",
  avatarSrc: "/avatars/old.png",
  playerId: "player-1" as PlayerId,
};

function createUseCases() {
  const profileCommands: ProfileCommands = {
    updateName: vi.fn(async ({ name }) => ({ profile: { ...profile, name } })),
  };
  const mediaAssetCommands: MediaAssetCommands = {
    prepareAvatar: vi.fn(async ({ assetId, objectPath }) => ({
      assetId,
      objectPath,
      status: "pending" as const,
    })),
    readAvatar: vi.fn(async () => ({
      assetId: "asset-1",
      objectPath: "avatars/player-1/asset-1.png",
      status: "pending" as const,
    })),
    confirmAvatar: vi.fn(async () => ({
      assetId: "asset-1",
      objectPath: "avatars/player-1/asset-1.png",
      oldObjectPath: "avatars/player-1/old.png",
      profile: { playerId: "player-1", name: "Ana", avatarPath: "avatars/player-1/asset-1.png" },
    })),
    abortAvatar: vi.fn(async ({ assetId }) => ({
      assetId,
      objectPath: "avatars/player-1/asset-1.png",
      status: "deleted" as const,
    })),
  };
  const mediaStorage: MediaStorage = {
    prepareUpload: vi.fn(async ({ assetId, objectPath }) => ({
      assetId,
      objectPath,
      signedUploadUrl: "https://upload.test/avatar",
      uploadToken: "token",
      expiresAt: "2026-09-30T10:10:00.000Z",
    })),
    inspectUpload: vi.fn(async () => ({
      mimeType: "image/png" as const,
      byteSize: 120,
      width: 64,
      height: 64,
      sha256: "hash",
    })),
    deleteObject: vi.fn(async () => undefined),
    createSignedReadUrl: vi.fn(),
    getPublicUrl: vi.fn(() => "/avatars/avatar.png"),
  };
  const currentViewer = { getCurrentViewer: vi.fn(async () => profile) };
  const useCases = new ApplicationProfileUseCases({
    actor: { authUserId: "auth-user", playerId: "player-1" as never },
    currentViewer,
    profileCommands,
    mediaAssetCommands,
    mediaStorage,
    assetIdGenerator: { generate: () => "asset-1" },
  });
  return { currentViewer, mediaAssetCommands, mediaStorage, profileCommands, useCases };
}

describe("ApplicationProfileUseCases", () => {
  it("validates and updates the profile name through the command port", async () => {
    const { profileCommands, useCases } = createUseCases();

    expect(await useCases.updateName(" A nombre ")).toEqual({
      ok: true,
      profile: { ...profile, name: "A nombre" },
    });
    expect(await useCases.updateName("x")).toMatchObject({ ok: false, code: "invalid_name" });
    expect(profileCommands.updateName).toHaveBeenCalledWith({ name: "A nombre" });
  });

  it("registers the pending avatar before preparing its upload", async () => {
    const { mediaAssetCommands, mediaStorage, useCases } = createUseCases();

    const result = await useCases.prepareAvatar({
      mimeType: "image/png",
      byteSize: 120,
      idempotencyKey: "upload-key",
    });

    expect(result.ok).toBe(true);
    expect(mediaAssetCommands.prepareAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: "asset-1", mimeType: "image/png" }),
    );
    expect(mediaStorage.prepareUpload).toHaveBeenCalledOnce();
  });

  it("preserves avatar idempotency conflicts without aborting the existing asset", async () => {
    const { mediaAssetCommands, mediaStorage, useCases } = createUseCases();
    vi.mocked(mediaAssetCommands.prepareAvatar).mockRejectedValue(
      new Error("idempotency_conflict"),
    );

    const result = await useCases.prepareAvatar({
      mimeType: "image/png",
      byteSize: 120,
      idempotencyKey: "upload-key",
    });

    expect(result).toMatchObject({ ok: false, code: "conflict" });
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.prepareUpload).not.toHaveBeenCalled();
  });

  it("confirms real inspected bytes, commits the profile association, then removes the old object", async () => {
    const { currentViewer, mediaAssetCommands, mediaStorage, useCases } = createUseCases();
    const updatedProfile = { ...profile, avatarSrc: "/avatars/new.png" };
    vi.mocked(currentViewer.getCurrentViewer).mockResolvedValue(updatedProfile);

    const result = await useCases.confirmAvatar({
      assetId: "asset-1",
      idempotencyKey: "confirm-key",
    });

    expect(result).toEqual({ ok: true, profile: updatedProfile });
    expect(mediaAssetCommands.confirmAvatar).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "asset-1",
        mimeType: "image/png",
        byteSize: 120,
        width: 64,
        height: 64,
      }),
    );
    expect(mediaStorage.deleteObject).toHaveBeenCalledWith({
      bucket: "avatars",
      objectPath: "avatars/player-1/old.png",
    });
    expect(currentViewer.getCurrentViewer).toHaveBeenCalledOnce();
  });

  it("compensates storage and SQL when byte inspection fails", async () => {
    const { mediaAssetCommands, mediaStorage, useCases } = createUseCases();
    vi.mocked(mediaStorage.inspectUpload).mockRejectedValue(new Error("unsupported_type"));

    const result = await useCases.confirmAvatar({
      assetId: "asset-1",
      idempotencyKey: "confirm-key",
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_file" });
    expect(mediaStorage.deleteObject).toHaveBeenCalledWith({
      bucket: "avatars",
      objectPath: "avatars/player-1/asset-1.png",
    });
    expect(mediaAssetCommands.abortAvatar).toHaveBeenCalledWith({ assetId: "asset-1" });
  });

  it("cleans up a pending avatar when the client aborts", async () => {
    const { mediaAssetCommands, mediaStorage, useCases } = createUseCases();

    await useCases.abortAvatar("asset-1");

    expect(mediaStorage.deleteObject).toHaveBeenCalledWith({
      bucket: "avatars",
      objectPath: "avatars/player-1/asset-1.png",
    });
    expect(mediaAssetCommands.abortAvatar).toHaveBeenCalledWith({ assetId: "asset-1" });
  });
});
