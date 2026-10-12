import { describe, expect, it, vi } from "vitest";
import { ApplicationSuperadminAccess } from "./superadmin";
import { SuperadminQuestionAssets } from "./superadmin-question-assets";

function createAccess(viewerPlayerId: string | null = "operator-1") {
  return new ApplicationSuperadminAccess({
    currentViewer: {
      getCurrentViewer: vi
        .fn()
        .mockResolvedValue(viewerPlayerId ? { playerId: viewerPlayerId } : null),
    },
    authenticatedUser: {
      getAuthenticatedUserId: vi.fn().mockResolvedValue("auth-1"),
    },
    portalQueries: {
      getContext: vi.fn().mockResolvedValue({
        operator: { playerId: "operator-1", displayName: "Operador" },
        rooms: [],
        source: "supabase",
      }),
    },
    requestIds: { generate: vi.fn().mockReturnValue("request-1") },
  });
}

function createAssets(viewerPlayerId?: string | null) {
  const commands = {
    prepare: vi.fn().mockResolvedValue({
      assetId: "asset-1",
      objectPath: "question-assets/asset-1.png",
      status: "pending",
    }),
    read: vi.fn(),
    confirm: vi.fn(),
    abort: vi.fn(),
    archive: vi.fn(),
  };
  const storage = {
    prepareUpload: vi.fn().mockResolvedValue({
      assetId: "asset-1",
      objectPath: "question-assets/asset-1.png",
      signedUploadUrl: "https://upload.example",
      uploadToken: "token",
      expiresAt: "2026-10-08T00:05:00.000Z",
    }),
    inspectUpload: vi.fn(),
    deleteObject: vi.fn(),
    createSignedReadUrl: vi.fn(),
  };
  return {
    assets: new SuperadminQuestionAssets({
      access: createAccess(viewerPlayerId),
      commands,
      storage,
      ids: { generate: vi.fn().mockReturnValue("asset-1") },
    }),
    commands,
    storage,
  };
}

describe("superadmin question asset use case", () => {
  it("validates files before touching authorization or storage", async () => {
    const { assets, commands, storage } = createAssets();

    await expect(
      assets.prepare({ mimeType: "text/plain", byteSize: 12, idempotencyKey: "asset-1" }),
    ).resolves.toEqual({
      ok: false,
      code: "invalid_file",
      message: "Elige un JPEG, PNG o WebP de hasta 50 MiB.",
    });
    expect(commands.prepare).not.toHaveBeenCalled();
    expect(storage.prepareUpload).not.toHaveBeenCalled();
  });

  it("uses the authenticated superadmin identity for SQL and Storage", async () => {
    const { assets, commands, storage } = createAssets();

    await expect(
      assets.prepare({ mimeType: "image/png", byteSize: 12, idempotencyKey: "asset-1" }),
    ).resolves.toMatchObject({ ok: true, assetId: "asset-1" });
    expect(commands.prepare).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({
        assetId: "asset-1",
        objectPath: "question-assets/asset-1.png",
      }),
    );
    expect(storage.prepareUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "question-assets",
        mimeType: "image/png",
      }),
    );
  });

  it("accepts exactly 50 MiB", async () => {
    const { assets, commands, storage } = createAssets();

    await expect(
      assets.prepare({
        mimeType: "image/png",
        byteSize: 50 * 1024 * 1024,
        idempotencyKey: "asset-1",
      }),
    ).resolves.toMatchObject({ ok: true, assetId: "asset-1" });
    expect(commands.prepare).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ byteSize: 50 * 1024 * 1024 }),
    );
    expect(storage.prepareUpload).toHaveBeenCalledOnce();
  });

  it("rejects 50 MiB plus one byte before preparing SQL or Storage", async () => {
    const { assets, commands, storage } = createAssets();

    await expect(
      assets.prepare({
        mimeType: "image/png",
        byteSize: 50 * 1024 * 1024 + 1,
        idempotencyKey: "asset-1",
      }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_file" });
    expect(commands.prepare).not.toHaveBeenCalled();
    expect(storage.prepareUpload).not.toHaveBeenCalled();
  });

  it("maps missing authentication to the existing operation error", async () => {
    const { assets } = createAssets(null);

    await expect(
      assets.prepare({ mimeType: "image/png", byteSize: 12, idempotencyKey: "asset-1" }),
    ).resolves.toEqual({
      ok: false,
      code: "unauthorized",
      message: "No tienes permisos para subir assets.",
    });
  });
});
