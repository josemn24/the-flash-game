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
    readConfirmation: vi.fn(async () => null),
    claimArchivedCleanup: vi.fn(async ({ objectPath }) => ({
      assetId: "old",
      objectPath,
      status: "deleted" as const,
    })),
    confirmAvatar: vi.fn(async () => ({
      assetId: "asset-1",
      objectPath: "avatars/player-1/asset-1.png",
      oldObjectPath: "avatars/player-1/old.png",
      profile: { ...profile, avatarSrc: "/avatars/new.png" },
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
    expect(currentViewer.getCurrentViewer).not.toHaveBeenCalled();
  });

  it("claims the SQL tombstone before deleting an invalid upload", async () => {
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
    expect(vi.mocked(mediaAssetCommands.abortAvatar).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(mediaStorage.deleteObject).mock.invocationCallOrder[0],
    );
  });

  it("cleans up a pending avatar when the client aborts", async () => {
    const { mediaAssetCommands, mediaStorage, useCases } = createUseCases();

    await useCases.abortAvatar("asset-1");

    expect(mediaStorage.deleteObject).toHaveBeenCalledWith({
      bucket: "avatars",
      objectPath: "avatars/player-1/asset-1.png",
    });
    expect(mediaAssetCommands.abortAvatar).toHaveBeenCalledWith({ assetId: "asset-1" });
    expect(vi.mocked(mediaAssetCommands.abortAvatar).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(mediaStorage.deleteObject).mock.invocationCallOrder[0],
    );
  });
});

describe("avatar confirmation resilience", () => {
  const input = { assetId: "asset-1", idempotencyKey: "confirm-key" };

  it("returns committed data even when the former profile refresh would fail", async () => {
    const { useCases, currentViewer, mediaStorage, mediaAssetCommands } = createUseCases();
    vi.mocked(currentViewer.getCurrentViewer).mockRejectedValue(new Error("read outage"));
    expect(await useCases.confirmAvatar(input)).toMatchObject({
      ok: true,
      profile: { avatarSrc: "/avatars/new.png" },
    });
    expect(currentViewer.getCurrentViewer).not.toHaveBeenCalled();
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.deleteObject).not.toHaveBeenCalledWith(
      expect.objectContaining({ objectPath: "avatars/player-1/asset-1.png" }),
    );
  });

  it("recovers a lost COMMIT acknowledgment from the durable command", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    const saved = await mediaAssetCommands.confirmAvatar({
      ...input,
      mimeType: "image/png",
      byteSize: 120,
      width: 64,
      height: 64,
      sha256: "hash",
    });
    vi.mocked(mediaAssetCommands.confirmAvatar)
      .mockClear()
      .mockRejectedValue(new Error("connection lost after COMMIT"));
    vi.mocked(mediaAssetCommands.readConfirmation)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    expect(await useCases.confirmAvatar(input)).toEqual({ ok: true, profile: saved.profile });
    expect(mediaAssetCommands.confirmAvatar).toHaveBeenCalledOnce();
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("replays without Storage and shows the current profile after a later replacement", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    const latest = { ...profile, avatarSrc: "/avatars/latest.png" };
    vi.mocked(mediaAssetCommands.readConfirmation).mockResolvedValue({
      assetId: "asset-1",
      objectPath: "avatars/player-1/asset-1.png",
      oldObjectPath: null,
      profile: latest,
    });
    expect(await useCases.confirmAvatar(input)).toEqual({ ok: true, profile: latest });
    expect(mediaAssetCommands.readAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.inspectUpload).not.toHaveBeenCalled();
    expect(mediaAssetCommands.confirmAvatar).not.toHaveBeenCalled();
  });

  it("preserves the file when both commit acknowledgment and recovery are unavailable", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    vi.mocked(mediaAssetCommands.readConfirmation)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("database unavailable"));
    vi.mocked(mediaAssetCommands.confirmAvatar).mockRejectedValue(new Error("COMMIT reply lost"));
    expect(await useCases.confirmAvatar(input)).toMatchObject({
      ok: false,
      code: "confirmation_pending",
    });
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.deleteObject).not.toHaveBeenCalled();
  });

  it("does not authorize cleanup from a transient inspection error or conflicting key", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    vi.mocked(mediaStorage.inspectUpload).mockRejectedValue(new Error("upload_missing"));
    expect(await useCases.confirmAvatar(input)).toMatchObject({ code: "confirmation_pending" });
    vi.mocked(mediaAssetCommands.readConfirmation).mockRejectedValue(
      new Error("idempotency_conflict"),
    );
    expect(await useCases.confirmAvatar(input)).toMatchObject({ code: "conflict" });
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.deleteObject).not.toHaveBeenCalled();
  });

  it.each(["ready", "archived"] as const)(
    "never deletes an abort result in state %s",
    async (status) => {
      const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
      vi.mocked(mediaAssetCommands.abortAvatar).mockResolvedValue({
        assetId: "asset-1",
        objectPath: "avatars/player-1/asset-1.png",
        status,
      });
      await useCases.abortAvatar("asset-1");
      expect(mediaStorage.deleteObject).not.toHaveBeenCalled();
    },
  );

  it("never deletes without acknowledgment of the cleanup claim", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    vi.mocked(mediaAssetCommands.abortAvatar).mockRejectedValue(new Error("lost commit reply"));
    await useCases.abortAvatar("asset-1");
    expect(mediaStorage.deleteObject).not.toHaveBeenCalled();
    vi.mocked(mediaAssetCommands.claimArchivedCleanup).mockRejectedValue(
      new Error("lost commit reply"),
    );
    expect(await useCases.confirmAvatar(input)).toMatchObject({ ok: true });
    expect(mediaStorage.deleteObject).not.toHaveBeenCalled();
  });

  it("keeps a successful confirmation when removal of the old object fails", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    vi.mocked(mediaStorage.deleteObject).mockRejectedValue(new Error("Storage unavailable"));
    expect(await useCases.confirmAvatar(input)).toMatchObject({ ok: true });
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
    expect(mediaStorage.deleteObject).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(mediaAssetCommands.claimArchivedCleanup).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(mediaStorage.deleteObject).mock.invocationCallOrder[0]);
  });

  it("does not issue another upload URL for a confirmed preparation", async () => {
    const { useCases, mediaAssetCommands, mediaStorage } = createUseCases();
    vi.mocked(mediaAssetCommands.prepareAvatar).mockResolvedValue({
      assetId: "asset-1",
      objectPath: "avatars/player-1/asset-1.png",
      status: "ready",
    });
    expect(
      await useCases.prepareAvatar({
        mimeType: "image/png",
        byteSize: 120,
        idempotencyKey: "upload-key",
      }),
    ).toMatchObject({ code: "conflict" });
    expect(mediaStorage.prepareUpload).not.toHaveBeenCalled();
    expect(mediaAssetCommands.abortAvatar).not.toHaveBeenCalled();
  });
});
