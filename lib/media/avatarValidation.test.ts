import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  inspectAvatarBytes,
  validateAvatarSelection,
} from "./avatarValidation";

function png(width: number, height: number) {
  const bytes = new Uint8Array(45);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44], 33);
  return bytes;
}

function jpeg(width: number, height: number) {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 7, 8, 0, 0, 0, 0, 0, 0, 0xff, 0xd9]);
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
}

function webp(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set([..."RIFF"].map((value) => value.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((value) => value.charCodeAt(0)), 8);
  bytes.set([..."VP8X"].map((value) => value.charCodeAt(0)), 12);
  bytes[24] = (width - 1) & 0xff;
  bytes[25] = ((width - 1) >> 8) & 0xff;
  bytes[26] = (width - 1) >> 16;
  bytes[27] = (height - 1) & 0xff;
  bytes[28] = ((height - 1) >> 8) & 0xff;
  bytes[29] = (height - 1) >> 16;
  return bytes;
}

describe("avatar byte validation", () => {
  it("detects real JPEG, PNG and WebP metadata", () => {
    expect(inspectAvatarBytes(jpeg(640, 480))).toMatchObject({ mimeType: "image/jpeg", width: 640, height: 480 });
    expect(inspectAvatarBytes(png(800, 600))).toMatchObject({ mimeType: "image/png", width: 800, height: 600 });
    expect(inspectAvatarBytes(webp(320, 240))).toMatchObject({ mimeType: "image/webp", width: 320, height: 240 });
  });

  it("rejects spoofed, corrupt, oversized and oversized-dimension files", () => {
    expect(() => inspectAvatarBytes(new TextEncoder().encode("image/png"))).toThrow("unsupported_type");
    expect(() => inspectAvatarBytes(new Uint8Array(AVATAR_MAX_BYTES + 1))).toThrow("too_large");
    expect(() => inspectAvatarBytes(png(2049, 100))).toThrow("dimensions");
    expect(() => inspectAvatarBytes(jpeg(0, 100))).toThrow("corrupt");
    expect(() => inspectAvatarBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toThrow("unsupported_type");
  });

  it("performs a strict preliminary browser validation", () => {
    expect(validateAvatarSelection({ type: "image/svg+xml", size: 10 } as File)).toBe("unsupported_type");
    expect(validateAvatarSelection({ type: "image/png", size: AVATAR_MAX_BYTES + 1 } as File)).toBe("too_large");
    expect(validateAvatarSelection({ type: "image/webp", size: 10 } as File)).toBeNull();
  });
});
