import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseMediaStorage } from "./mediaStorage";

const storage = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => storage } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("browser Storage URLs", () => {
  it("makes signed uploads accessible from the mobile app origin while preserving the token", async () => {
    storage.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl:
          "http://127.0.0.1:54321/storage/v1/object/upload/sign/avatars/player.png?token=upload%2Btoken",
        token: "upload+token",
      },
      error: null,
    });
    const prepared = await supabaseMediaStorage.prepareUpload({
      bucket: "avatars",
      assetId: "asset-1",
      objectPath: "player.png",
      mimeType: "image/png",
    });
    expect(prepared).toMatchObject({
      signedUploadUrl:
        "/__local-supabase/storage/v1/object/upload/sign/avatars/player.png?token=upload%2Btoken",
      uploadToken: "upload+token",
    });
  });

  it("makes private question images and public avatars accessible from the mobile app origin", async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: {
        signedUrl:
          "http://127.0.0.1:54321/storage/v1/object/sign/question-assets/image.png?token=read%2Ftoken",
      },
      error: null,
    });
    const signed = await supabaseMediaStorage.createSignedReadUrl({
      bucket: "question-assets",
      objectPath: "image.png",
      expiresInSeconds: 300,
    });
    expect(signed.signedUrl).toBe(
      "/__local-supabase/storage/v1/object/sign/question-assets/image.png?token=read%2Ftoken",
    );
    expect(storage.createSignedUrl).toHaveBeenCalledWith("image.png", 300);
    expect(supabaseMediaStorage.getPublicUrl("player.png")).toBe(
      "/__local-supabase/storage/v1/object/public/avatars/player.png",
    );
  });
});
