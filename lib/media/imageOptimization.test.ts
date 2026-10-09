import { describe, expect, it } from "vitest";
import { shouldBypassImageOptimization } from "./imageOptimization";

describe("image optimization policy", () => {
  it.each([
    "http://127.0.0.1:54321/storage/v1/object/sign/question-assets/image.png?token=signed",
    "https://project.supabase.co/storage/v1/object/public/avatars/player.png",
    "https://images.example.com/photo.jpg?signature=opaque",
    "/__local-supabase/storage/v1/object/sign/question-assets/image.png?token=signed",
    "/__local-supabase/storage/v1/object/public/avatars/player.png",
    "data:image/png;base64,test",
    "blob:http://localhost:3000/image-id",
    "/visuals/icon.svg",
    "/visuals/icon.svg?version=2",
  ])("serves the original source for %s", (src) => {
    expect(shouldBypassImageOptimization(src)).toBe(true);
  });

  it.each([
    "/visuals/photo.png",
    "/avatars/player.jpg?version=2",
    "/visuals/photo.webp?download=icon.svg",
    "/__local-supabase/visuals/photo.png",
    "/__local-supabase/storage/v1/object-other/photo.png",
  ])("keeps local raster images eligible for optimization: %s", (src) => {
    expect(shouldBypassImageOptimization(src)).toBe(false);
  });
});
