import { createHash } from "node:crypto";

export const AVATAR_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_DIMENSION = 2048;
export const QUESTION_ASSET_MAX_BYTES = 50 * 1024 * 1024;
export const QUESTION_ASSET_MAX_DIMENSION = 8192;

export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

export type AvatarInspection = {
  readonly mimeType: AvatarMimeType;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
};

export type AvatarInspectionError =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "corrupt"
  | "dimensions";

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function is(bytes: Uint8Array, offset: number, value: string) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function hasJpegEnd(bytes: Uint8Array) {
  for (let index = 2; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return true;
  }
  return false;
}

function inspectPng(bytes: Uint8Array) {
  if (bytes.length < 24 || !is(bytes, 0, "\x89PNG\r\n\x1a\n") || !is(bytes, 12, "IHDR")) {
    return null;
  }
  return { mimeType: "image/png" as const, width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
}

function inspectJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isSizeMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSizeMarker && segmentLength >= 7) {
      if (!hasJpegEnd(bytes)) return null;
      return {
        mimeType: "image/jpeg" as const,
        height: readUint16(bytes, offset + 3),
        width: readUint16(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function inspectWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || !is(bytes, 0, "RIFF") || !is(bytes, 8, "WEBP")) return null;
  if (is(bytes, 12, "VP8X")) {
    return {
      mimeType: "image/webp" as const,
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (is(bytes, 12, "VP8 ")) {
    const start = 20;
    if (bytes.length < start + 10 || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) {
      return null;
    }
    return { mimeType: "image/webp" as const, width: readUint16(bytes, start + 6) & 0x3fff, height: readUint16(bytes, start + 8) & 0x3fff };
  }
  if (is(bytes, 12, "VP8L") && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { mimeType: "image/webp" as const, width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

export function inspectImageBytes(
  input: Uint8Array,
  limits: { readonly maxBytes: number; readonly maxDimension: number },
): AvatarInspection {
  if (input.byteLength === 0) throw new Error("empty");
  if (input.byteLength > limits.maxBytes) throw new Error("too_large");

  const header = inspectPng(input) ?? inspectJpeg(input) ?? inspectWebp(input);
  if (!header) throw new Error("unsupported_type");
  if (
    !Number.isInteger(header.width) ||
    !Number.isInteger(header.height) ||
    header.width <= 0 ||
    header.height <= 0
  ) {
    throw new Error("corrupt");
  }
  if (header.width > limits.maxDimension || header.height > limits.maxDimension) {
    throw new Error("dimensions");
  }

  return {
    ...header,
    byteSize: input.byteLength,
    sha256: createHash("sha256").update(input).digest("hex"),
  };
}

export function inspectAvatarBytes(input: Uint8Array): AvatarInspection {
  return inspectImageBytes(input, { maxBytes: AVATAR_MAX_BYTES, maxDimension: AVATAR_MAX_DIMENSION });
}

export function inspectQuestionAssetBytes(input: Uint8Array): AvatarInspection {
  return inspectImageBytes(input, {
    maxBytes: QUESTION_ASSET_MAX_BYTES,
    maxDimension: QUESTION_ASSET_MAX_DIMENSION,
  });
}

export function validateAvatarSelection(file: Pick<File, "size" | "type">) {
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as AvatarMimeType)) return "unsupported_type" as const;
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) return "too_large" as const;
  return null;
}
