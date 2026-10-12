import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAvatarPath } from "./publicAvatar";

afterEach(() => vi.unstubAllEnvs());

describe("local avatar URLs", () => {
  it("serves stored avatars and legacy Storage URLs from the app origin in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const expected =
      "/__local-supabase/storage/v1/object/public/avatars/avatars/player/photo%20one.png";
    expect(resolveAvatarPath("avatars/player/photo one.png")).toBe(expected);
    expect(
      resolveAvatarPath(
        "http://127.0.0.1:54321/storage/v1/object/public/avatars/avatars/player/photo%20one.png",
      ),
    ).toBe(expected);
    expect(resolveAvatarPath("/avatars/legacy.png")).toBe("/avatars/legacy.png");
    expect(resolveAvatarPath(null)).toBeUndefined();
  });

  it("keeps production avatars on Supabase", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    expect(resolveAvatarPath("avatars/player/photo.png")).toBe(
      "https://project.supabase.co/storage/v1/object/public/avatars/avatars/player/photo.png",
    );
  });
});
